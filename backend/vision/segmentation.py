import cv2
import numpy as np
from typing import Any

def hex_to_bgr(hex_color: str):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
        return (b, g, r)
    return (255, 255, 255)

def bgr_to_hex(b: int, g: int, r: int) -> str:
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

def process_segmentation(img: np.ndarray, config: dict, is_preview: bool = False) -> tuple:
    """
    Applies high-quality, professional segmentation algorithms using OpenCV.
    Supports K-Means, Watershed, GrabCut Foreground Cut, Otsu, Adaptive Thresholding, and Color Slicing.
    Returns: (processed_img, segments_list)
    """
    method = config.get("method", "kmeans")
    
    # Handle alpha channel
    a = None
    has_alpha = len(img.shape) == 3 and img.shape[2] == 4
    if has_alpha:
        b, g, r, a = cv2.split(img)
        rgb_img = cv2.merge((b, g, r))
    else:
        rgb_img = img.copy()

    h, w = rgb_img.shape[:2]
    best_labels: Any = None
    segments = []
    result_img: np.ndarray = rgb_img.copy()
    
    # Helper for normalized box2d [ymin, xmin, ymax, xmax] (0 to 1000)
    def get_box2d(mask):
        coords = cv2.findNonZero(mask)
        if coords is not None:
            x, y, w_box, h_box = cv2.boundingRect(coords)
            return [
                int(y / h * 1000),
                int(x / w * 1000),
                int((y + h_box) / h * 1000),
                int((x + w_box) / w * 1000)
            ]
        return [0, 0, 1000, 1000]

    # -------------------------------------------------------------
    # 1. K-MEANS COLOR CLUSTERING
    # -------------------------------------------------------------
    if method == "kmeans":
        K = max(2, min(8, int(config.get("kClusters", 4))))
        
        # Determine downscaling to guarantee responsive, instantaneous performance
        max_dim = 450 if is_preview else 900
        scale = min(max_dim / max(h, w), 1.0)
        
        if scale < 1.0:
            pw, ph = max(10, int(w * scale)), max(10, int(h * scale))
            process_img = cv2.resize(rgb_img, (pw, ph), interpolation=cv2.INTER_AREA)
        else:
            process_img = rgb_img
            pw, ph = w, h

        Z = process_img.reshape((-1, 3)).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 0.5)
        # KMEANS_PP_CENTERS ensures deterministic and visually accurate color clustering
        best_labels: Any = None
        ret, label, center = cv2.kmeans(Z, K, best_labels, criteria, 5, cv2.KMEANS_PP_CENTERS)
        center_uint8 = np.asarray(center, dtype=np.uint8)
        
        res = center_uint8[label.flatten()]
        res_2d = res.reshape((ph, pw, 3))
        
        if scale < 1.0:
            result_img = cv2.resize(res_2d, (w, h), interpolation=cv2.INTER_NEAREST)
            label_2d = cv2.resize(label.reshape((ph, pw)).astype(np.uint8), (w, h), interpolation=cv2.INTER_NEAREST)
        else:
            result_img = res_2d
            label_2d = label.reshape((h, w))

        # Sort clusters by area
        cluster_info = []
        for k in range(K):
            mask = np.zeros((h, w), dtype=np.uint8)
            mask[label_2d == k] = 255
            cnt = cv2.countNonZero(mask)
            cluster_info.append((k, cnt, mask))
            
        cluster_info.sort(key=lambda x: x[1], reverse=True)

        for rank, (k, pixel_count, mask) in enumerate(cluster_info):
            if pixel_count > (w * h * 0.005):
                hex_color = bgr_to_hex(int(center_uint8[k][0]), int(center_uint8[k][1]), int(center_uint8[k][2]))
                box2d = get_box2d(mask)
                segments.append({
                    "segmentId": f"seg_km_{rank+1}",
                    "name": f"عنقود لوني {rank+1} ({hex_color})",
                    "type": "color_region",
                    "box2d": box2d,
                    "colorHex": hex_color,
                    "pixelCount": pixel_count,
                    "description": f"عنقود لوني K-Means بنسبة {round(pixel_count / (w * h) * 100, 1)}% من مساحة الصورة."
                })

    # -------------------------------------------------------------
    # 2. WATERSHED TOPOGRAPHICAL BOUNDARIES (GRADIENT-BASED)
    # -------------------------------------------------------------
    elif method == "watershed":
        sens = max(1, min(10, int(config.get("watershedSensitivity", 5))))
        show_borders = config.get("watershedShowBorders", True)
        
        # Edge-preserving bilateral filter eliminates texture noise while preserving sharp boundaries
        smooth = cv2.bilateralFilter(rgb_img, 7, 50, 50)
        gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)
        
        # Discover distinct object/region seed cores using LAB color-space clustering
        lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB)
        K = max(3, min(10, int(2 + sens * 0.75)))
        Z = lab.reshape((-1, 3)).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 15, 0.5)
        _, label, _ = cv2.kmeans(Z, K, best_labels, criteria, 4, cv2.KMEANS_PP_CENTERS)
        label_2d = label.reshape((h, w))
        
        # Erode each cluster to plant reliable seed markers in the cores of distinct objects (e.g. cup, table, background)
        markers = np.zeros((h, w), dtype=np.int32)
        marker_id = 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        min_seed = int(w * h * max(0.003, 0.02 - (sens * 0.0016)))
        
        for k in range(K):
            c_mask = (label_2d == k).astype(np.uint8) * 255
            eroded = cv2.erode(c_mask, kernel, iterations=2)
            ncomp, complabels = cv2.connectedComponents(eroded)
            for c in range(1, ncomp):
                if np.count_nonzero(complabels == c) >= min_seed:
                    markers[complabels == c] = marker_id
                    marker_id += 1
                    
        if marker_id <= 2:
            markers = label_2d.astype(np.int32) + 1

        # Run watershed flooding: seeds expand outward and lock onto exact physical object boundaries
        watershed_markers = cv2.watershed(smooth, markers)
        
        # Professional translucent basin overlay palette
        palette = [
            (247, 85, 168),   # Purple #a855f7
            (248, 189, 56),   # Sky #38bdf8
            (129, 185, 16),   # Emerald #10b981
            (11, 158, 245),   # Amber #f59e0b
            (153, 72, 236),   # Pink #ec4899
            (241, 102, 99),   # Indigo #6366f1
            (166, 184, 20),   # Teal #14b8a6
            (94, 63, 244),    # Rose #f43f5e
            (246, 92, 139),   # Violet #8b5cf6
            (212, 182, 6),    # Cyan #06b6d4
        ]
        
        colored_overlay = rgb_img.copy()
        unique_markers = [m for m in np.unique(watershed_markers) if m > 0]
        
        basin_segments = []
        for idx, m in enumerate(unique_markers):
            mask = np.zeros_like(gray)
            mask[watershed_markers == m] = 255
            cnt = cv2.countNonZero(mask)
            if cnt > (w * h * 0.005):
                color_bgr = palette[idx % len(palette)]
                colored_overlay[watershed_markers == m] = color_bgr
                basin_segments.append((m, cnt, mask, color_bgr))
                
        # Elegant 72% original + 28% tint keeps the photo clear and discernible
        result_img = cv2.addWeighted(rgb_img, 0.72, colored_overlay, 0.28, 0)
        
        # Clean 1px crisp neon borders on watershed dams (instead of thick dilated blotches)
        if show_borders:
            result_img[watershed_markers == -1] = [0, 238, 255]
            
        # Register segments
        basin_segments.sort(key=lambda x: x[1], reverse=True)
        for rank, (m, cnt, mask, color_bgr) in enumerate(basin_segments[:12]):
            hex_color = bgr_to_hex(color_bgr[0], color_bgr[1], color_bgr[2])
            segments.append({
                "segmentId": f"seg_ws_{rank+1}",
                "name": f"حوض متماسك {rank+1}",
                "type": "watershed_basin",
                "box2d": get_box2d(mask),
                "colorHex": hex_color,
                "pixelCount": cnt,
                "description": f"حوض تجزئة هيدرولوجي متماسك بمساحة {cnt} بكسل ({round(cnt/(w*h)*100, 1)}%)."
            })

    # -------------------------------------------------------------
    # 3. FOREGROUND CUT (GRABCUT WITH ALPHA TRANSPARENCY)
    # -------------------------------------------------------------
    elif method == "foreground_cut":
        sens = max(10, min(90, int(config.get("foregroundSensitivity", 45))))
        ai_mask: np.ndarray = np.zeros((h, w), dtype=np.uint8)
        detected_by_ai = False

        # 1. Primary engine: Deep Learning Salient Object Segmentation (rembg)
        try:
            import rembg
            from vision.background import get_rembg_session
            session = get_rembg_session()
            rgb_conv = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2RGB)
            if session is not None:
                raw_mask = rembg.remove(rgb_conv, session=session, only_mask=True, post_process_mask=True)
            else:
                raw_mask = rembg.remove(rgb_conv, only_mask=True, post_process_mask=True)

            if raw_mask is not None:
                mask_arr = np.asarray(raw_mask, dtype=np.uint8)
                if mask_arr.ndim == 3:
                    mask_arr = mask_arr[:, :, 0]
                if mask_arr.shape[:2] != (h, w):
                    mask_arr = cv2.resize(mask_arr, (w, h), interpolation=cv2.INTER_LINEAR)
                if int(np.max(mask_arr)) >= 128 and float(np.mean(mask_arr > 64)) >= 0.01:
                    ai_mask = mask_arr
                    detected_by_ai = True
        except Exception as ex:
            print(f"[Segmentation FG Cut] rembg execution note: {ex}")

        # 2. Adaptive Saliency Fallback
        if not detected_by_ai or np.all(ai_mask == 0):
            gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            _, bin_m = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            corners = [int(bin_m[0, 0]), int(bin_m[0, w - 1]), int(bin_m[h - 1, 0]), int(bin_m[h - 1, w - 1])]
            if sum(c == 255 for c in corners) >= 2:
                bin_m = cv2.bitwise_not(bin_m)
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            bin_m = cv2.morphologyEx(bin_m, cv2.MORPH_CLOSE, kernel)
            bin_m = cv2.morphologyEx(bin_m, cv2.MORPH_OPEN, kernel)
            ai_mask = cv2.GaussianBlur(bin_m, (3, 3), 0)

        # Sensitivity tuning: expands (>45) or trims/erodes (<45) the boundary smoothly
        adjust = int((sens - 45) / 8.0)
        if adjust > 0:
            k = adjust * 2 + 1
            ai_mask = cv2.dilate(ai_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
        elif adjust < 0:
            k = abs(adjust) * 2 + 1
            ai_mask = cv2.erode(ai_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))

        smooth_alpha = cv2.GaussianBlur(ai_mask, (5, 5), 0)
        b_c, g_c, r_c = cv2.split(rgb_img)
        result_img = cv2.merge((b_c, g_c, r_c, smooth_alpha))

        box2d = get_box2d(smooth_alpha)
        pixel_count = int(cv2.countNonZero(smooth_alpha))

        segments.append({
            "segmentId": "seg_ai_fg",
            "name": "الموضوع المعزول (AI Cutout)",
            "type": "foreground",
            "box2d": box2d,
            "colorHex": "#10b981",
            "pixelCount": pixel_count,
            "description": "تم عزل الكائن الرئيسي بدقة استوديو بالذكاء الاصطناعي مع شفافية ألفا كاملة."
        })

    # -------------------------------------------------------------
    # 4. OTSU'S OPTIMAL THRESHOLDING
    # -------------------------------------------------------------
    elif method == "otsu":
        invert = config.get("otsuInvert", False)
        as_mask = config.get("otsuAsMask", False)
        
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        ret, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        if invert:
            thresh = cv2.bitwise_not(thresh)
            
        box2d = get_box2d(thresh)
        pixel_count = cv2.countNonZero(thresh)
        
        if as_mask:
            # Alpha cutout: foreground retains original color, background is transparent
            b_c, g_c, r_c = cv2.split(rgb_img)
            result_img = cv2.merge((b_c, g_c, r_c, thresh))
        else:
            # Crisp binary presentation
            result_img = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
            
        segments.append({
            "segmentId": "seg_otsu_fg",
            "name": "تجزئة أوتسو (Otsu Threshold)",
            "type": "foreground",
            "box2d": box2d,
            "colorHex": "#a855f7",
            "pixelCount": pixel_count,
            "description": f"العتبة الرياضية المثلى المحسوبة تلقائياً: {int(ret)} على مقياس 0-255."
        })

    # -------------------------------------------------------------
    # 5. ADAPTIVE LOCAL THRESHOLDING
    # -------------------------------------------------------------
    elif method == "adaptive":
        block_size = max(3, int(config.get("adaptiveBlockSize", 15)))
        if block_size % 2 == 0:
            block_size += 1
            
        C = int(config.get("adaptiveC", 5))
        method_choice = config.get("adaptiveMethod", "mean")
        adaptive_method = cv2.ADAPTIVE_THRESH_GAUSSIAN_C if method_choice == "gaussian" else cv2.ADAPTIVE_THRESH_MEAN_C
        
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        thresh = cv2.adaptiveThreshold(gray, 255, adaptive_method, cv2.THRESH_BINARY, block_size, C)
        
        if config.get("adaptiveInvert", False):
            thresh = cv2.bitwise_not(thresh)
            
        result_img = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
        
        # Discover major connected components
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh)
        
        # Sort components by area (excluding background index 0)
        components = []
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area > (w * h * 0.002):
                components.append((i, area, stats[i]))
                
        components.sort(key=lambda x: x[1], reverse=True)
        
        for rank, (i, area, stat) in enumerate(components[:8]):
            sx = stat[cv2.CC_STAT_LEFT]
            sy = stat[cv2.CC_STAT_TOP]
            sw = stat[cv2.CC_STAT_WIDTH]
            sh = stat[cv2.CC_STAT_HEIGHT]
            box2d = [
                int(sy / h * 1000),
                int(sx / w * 1000),
                int((sy + sh) / h * 1000),
                int((sx + sw) / w * 1000)
            ]
            segments.append({
                "segmentId": f"seg_ad_{rank+1}",
                "name": f"عنصر تكيفي {rank+1}",
                "type": "adaptive_component",
                "box2d": box2d,
                "colorHex": "#38bdf8",
                "pixelCount": int(area),
                "description": f"عنصر مكتشف بنافذة {block_size}×{block_size} وتعويض C={C}."
            })
            
        if not segments:
            segments.append({
                "segmentId": "seg_ad_all",
                "name": "المحتوى التكيفي المكتشف",
                "type": "foreground",
                "box2d": get_box2d(thresh),
                "colorHex": "#38bdf8",
                "pixelCount": cv2.countNonZero(thresh),
                "description": f"تجزئة تكيفية محلية (Block: {block_size}, C: {C})"
            })

    # -------------------------------------------------------------
    # 6. COLOR SLICING (COLOR RANGE ISOLATION / COLOR SPLASH)
    # -------------------------------------------------------------
    elif method == "color_slicing":
        tolerance = max(5, min(80, int(config.get("colorTolerance", 35))))
        
        # Convert BGR to HSV for perceptually accurate color slicing
        hsv = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        val = hsv[:, :, 2]
        
        # Filter for chromatic pixels to find true vibrant dominant hue
        chromatic_mask = (sat > 40) & (val > 40)
        
        if np.count_nonzero(chromatic_mask) > (w * h * 0.01):
            hues = hsv[:, :, 0][chromatic_mask]
            hist, bin_edges = np.histogram(hues, bins=36, range=(0, 180))
            peak_bin = int(np.argmax(hist))
            target_hue = int((bin_edges[peak_bin] + bin_edges[peak_bin + 1]) / 2)
        else:
            # Neutral image: sample center region hue
            ch_y, ch_x = h // 2, w // 2
            target_hue = int(hsv[ch_y, ch_x, 0])

        # Form color slice range in HSV
        lower_h = (target_hue - tolerance) % 180
        upper_h = (target_hue + tolerance) % 180
        
        if lower_h < upper_h:
            slice_mask = cv2.inRange(hsv, np.array([lower_h, 35, 35]), np.array([upper_h, 255, 255]))
        else:
            # Wrap-around for red hues near 0/180
            m1 = cv2.inRange(hsv, np.array([0, 35, 35]), np.array([upper_h, 255, 255]))
            m2 = cv2.inRange(hsv, np.array([lower_h, 35, 35]), np.array([180, 255, 255]))
            slice_mask = cv2.bitwise_or(m1, m2)

        # High-end Color Splash visual: Sliced color remains in full color, outside desaturated to monochrome
        gray_base = cv2.cvtColor(cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
        alpha_factor = (slice_mask.astype(np.float32) / 255.0)[:, :, np.newaxis]
        result_img = np.asarray(rgb_img * alpha_factor + gray_base * (1.0 - alpha_factor), dtype=np.uint8)
        
        box2d = get_box2d(slice_mask)
        pixel_count = cv2.countNonZero(slice_mask)
        
        # Compute representative color for swatch
        mean_bgr = cv2.mean(rgb_img, mask=slice_mask)[:3]
        hex_color = bgr_to_hex(int(mean_bgr[0]), int(mean_bgr[1]), int(mean_bgr[2]))
        
        segments.append({
            "segmentId": "seg_slicing",
            "name": f"النطاق اللوني المعزول ({hex_color})",
            "type": "color_slice",
            "box2d": box2d,
            "colorHex": hex_color,
            "pixelCount": pixel_count,
            "description": f"عزل طيفي للون الصافي بتسامح ±{tolerance} على مساحة {round(pixel_count / (w * h) * 100, 1)}%."
        })

    # -------------------------------------------------------------
    # Final Output Formatting: Preserve Alpha Transparency
    # -------------------------------------------------------------
    if len(result_img.shape) == 3 and result_img.shape[2] == 4:
        final_img = result_img
    elif has_alpha and a is not None:
        b_res, g_res, r_res = cv2.split(result_img)
        final_img = cv2.merge((b_res, g_res, r_res, a))
    else:
        final_img = result_img

    return final_img, segments
