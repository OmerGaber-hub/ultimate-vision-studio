import cv2
import numpy as np

# Singleton session for rembg deep learning model (u2netp)
_rembg_session = None

def get_rembg_session():
    """
    Returns a cached ONNX session for rembg background removal.
    Uses 'u2netp' (4.5 MB, lightweight, running in < 0.8s), with fallback to 'u2net'.
    """
    global _rembg_session
    if _rembg_session is None:
        try:
            import rembg
            _rembg_session = rembg.new_session("u2netp")
            print("[Vision Studio BG] Loaded u2netp background model session successfully.")
        except Exception as e:
            print(f"[Vision Studio BG] Could not load u2netp session ({e}), attempting u2net fallback...")
            try:
                import rembg
                _rembg_session = rembg.new_session("u2net")
                print("[Vision Studio BG] Loaded u2net fallback session successfully.")
            except Exception as e2:
                print(f"[Vision Studio BG] Could not load rembg session: {e2}")
                _rembg_session = False
    return _rembg_session if _rembg_session is not False else None


def process_bg_removal(img: np.ndarray, config: dict) -> np.ndarray:
    """
    Studio-quality comprehensive background removal supporting all modes:
      - 'smart' / 'ai_click': Neural network salient object segmentation (rembg u2netp)
      - 'chroma' / 'magic_wand': Seeded FloodFill or global color keying with tolerance
      - 'preset_white': Studio pure/off-white background keying
      - 'preset_green': Film/studio green-screen chroma keying with color despill
      - 'preset_black': Dark studio backdrop removal
    Supports edge feathering, mask inversion, and preserves existing layer alpha channels.
    """
    if img is None or img.size == 0:
        return img

    mode = config.get("mode", "smart")
    if mode == "ai_click":
        mode = "smart"
    elif mode == "magic_wand":
        mode = "chroma"

    h, w = img.shape[:2]

    # Handle input channels (separate BGR colors and existing alpha mask)
    if img.ndim == 2:
        bgr_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        existing_alpha = np.ones((h, w), dtype=np.uint8) * 255
    elif img.shape[2] == 4:
        bgr_img = img[:, :, :3].copy()
        existing_alpha = img[:, :, 3].copy()
    else:
        bgr_img = img[:, :, :3].copy()
        existing_alpha = np.ones((h, w), dtype=np.uint8) * 255

    click_x = config.get("clickX")
    click_y = config.get("clickY")
    tolerance = int(config.get("tolerance", 30))
    tol_val = max(5, min(140, tolerance))
    feather = max(0, min(15, int(config.get("feather", 3))))
    invert = bool(config.get("invert", False))

    fg_mask: np.ndarray = np.ones((h, w), dtype=np.uint8) * 255

    # =========================================================================
    # 1. STUDIO WHITE PRESET (خلفية بيضاء استوديو)
    # =========================================================================
    if mode in ("preset_white", "white"):
        b, g, r = bgr_img[:, :, 0].astype(int), bgr_img[:, :, 1].astype(int), bgr_img[:, :, 2].astype(int)
        thresh = max(160, 255 - tol_val * 2)
        # Background is where R, G, B are all high and near neutral
        is_bg = (r >= thresh) & (g >= thresh) & (b >= thresh) & (np.abs(r - g) < 25) & (np.abs(g - b) < 25)
        bg_mask = is_bg.astype(np.uint8) * 255
        fg_mask = cv2.bitwise_not(bg_mask)

    # =========================================================================
    # 2. GREEN SCREEN CHROMA PRESET (كروما خضراء سينمائية)
    # =========================================================================
    elif mode in ("preset_green", "green", "greenscreen"):
        b, g, r = bgr_img[:, :, 0].astype(int), bgr_img[:, :, 1].astype(int), bgr_img[:, :, 2].astype(int)
        diff_threshold = max(15, min(80, int(tol_val * 0.8)))
        # Green channel dominates both Red and Blue
        is_green = (g - r > diff_threshold) & (g - b > diff_threshold) & (g > 60)
        bg_mask = is_green.astype(np.uint8) * 255
        fg_mask = cv2.bitwise_not(bg_mask)

        # Green Despill: suppress green color bleed along the transparent boundaries
        green_fringe = (g - np.maximum(r, b) > 5) & (is_green == False)
        if np.any(green_fringe):
            avg_rb = ((r + b) / 2).astype(np.uint8)
            bgr_img[:, :, 1] = np.where(green_fringe, avg_rb, bgr_img[:, :, 1])

    # =========================================================================
    # 3. STUDIO BLACK PRESET (خلفية سوداء معتمة)
    # =========================================================================
    elif mode in ("preset_black", "black"):
        b, g, r = bgr_img[:, :, 0].astype(int), bgr_img[:, :, 1].astype(int), bgr_img[:, :, 2].astype(int)
        thresh = min(110, 15 + tol_val * 2)
        is_dark = (r <= thresh) & (g <= thresh) & (b <= thresh)
        bg_mask = is_dark.astype(np.uint8) * 255
        fg_mask = cv2.bitwise_not(bg_mask)

    # =========================================================================
    # 4. CHROMA / MAGIC WAND (العصا السحرية والتفريغ اللوني المتصل والعام)
    # =========================================================================
    elif mode == "chroma":
        target_color = config.get("color")
        contiguous = config.get("contiguous", True)

        if click_x is not None and click_y is not None:
            cx = max(0, min(w - 1, int(click_x)))
            cy = max(0, min(h - 1, int(click_y)))
            clicked_bgr = bgr_img[cy, cx].astype(float)

            if contiguous:
                # Connected flood fill from exact click coordinate
                flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
                flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
                cv2.floodFill(
                    bgr_img,
                    flood_mask,
                    (cx, cy),
                    (0, 0, 0),
                    (tol_val, tol_val, tol_val),
                    (tol_val, tol_val, tol_val),
                    flags
                )
                bg_mask = flood_mask[1:h + 1, 1:w + 1]
            else:
                # Global color keying of all matching pixels
                dist = np.sqrt(np.sum((bgr_img.astype(float) - clicked_bgr) ** 2, axis=2))
                bg_mask = (dist <= tol_val).astype(np.uint8) * 255

            fg_mask = cv2.bitwise_not(bg_mask)

        elif target_color and isinstance(target_color, dict):
            # Key out specific target color
            tr = target_color.get('r', 255)
            tg = target_color.get('g', 255)
            tb = target_color.get('b', 255)
            t_bgr = np.array([tb, tg, tr], dtype=float)
            dist = np.sqrt(np.sum((bgr_img.astype(float) - t_bgr) ** 2, axis=2))
            
            if contiguous:
                # Sample corners to find seed points near target color
                flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
                flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
                seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
                for sx, sy in seeds:
                    if flood_mask[sy + 1, sx + 1] == 0:
                        cv2.floodFill(
                            bgr_img, flood_mask, (sx, sy), (0, 0, 0),
                            (tol_val, tol_val, tol_val), (tol_val, tol_val, tol_val), flags
                        )
                bg_mask = flood_mask[1:h + 1, 1:w + 1]
            else:
                bg_mask = (dist <= tol_val).astype(np.uint8) * 255

            fg_mask = cv2.bitwise_not(bg_mask)

        else:
            # Fallback: Sample 4 outer corners of the image as background seeds
            flood_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
            flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
            seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
            for pt in seeds:
                if flood_mask[pt[1] + 1, pt[0] + 1] == 0:
                    cv2.floodFill(
                        bgr_img, flood_mask, pt, (0, 0, 0),
                        (tol_val, tol_val, tol_val), (tol_val, tol_val, tol_val), flags
                    )
            bg_mask = flood_mask[1:h + 1, 1:w + 1]
            fg_mask = cv2.bitwise_not(bg_mask)

    # =========================================================================
    # 5. SMART AI SEGMENTATION (عزل الذكاء الاصطناعي العميق U2Net)
    # =========================================================================
    else:
        ai_alpha: np.ndarray = np.zeros((h, w), dtype=np.uint8)
        detected_by_ai = False

        try:
            import rembg
            session = get_rembg_session()
            rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

            if session is not None:
                raw_mask = rembg.remove(rgb_img, session=session, only_mask=True, post_process_mask=True)
            else:
                raw_mask = rembg.remove(rgb_img, only_mask=True, post_process_mask=True)

            if raw_mask is not None:
                mask_arr = np.asarray(raw_mask, dtype=np.uint8)
                if mask_arr.ndim == 3:
                    mask_arr = mask_arr[:, :, 0]
                if mask_arr.shape[:2] != (h, w):
                    mask_arr = cv2.resize(mask_arr, (w, h), interpolation=cv2.INTER_LINEAR)

                if int(np.max(mask_arr)) >= 128 and float(np.mean(mask_arr > 64)) >= 0.01:
                    ai_alpha = mask_arr
                    detected_by_ai = True
        except Exception as ex:
            print(f"[Vision Studio BG] rembg execution note: {ex}")

        # Adaptive Saliency Fallback (for graphics, illustrations, high-contrast subjects)
        if not detected_by_ai or np.all(ai_alpha == 0):
            gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            _, bin_m = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            corners = [int(bin_m[0, 0]), int(bin_m[0, w - 1]), int(bin_m[h - 1, 0]), int(bin_m[h - 1, w - 1])]
            if sum(c == 255 for c in corners) >= 2:
                bin_m = cv2.bitwise_not(bin_m)

            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            bin_m = cv2.morphologyEx(bin_m, cv2.MORPH_CLOSE, kernel)
            bin_m = cv2.morphologyEx(bin_m, cv2.MORPH_OPEN, kernel)
            ai_alpha = cv2.GaussianBlur(bin_m, (3, 3), 0)

        fg_mask = ai_alpha

    # =========================================================================
    # POST-PROCESSING: Invert, Feathering & Channel Merge
    # =========================================================================
    if invert:
        fg_mask = cv2.bitwise_not(fg_mask)

    if feather > 0:
        k = feather * 2 + 1
        fg_mask = cv2.GaussianBlur(fg_mask, (k, k), 0)

    # Combine with existing layer alpha channel (preserving manual erasures)
    final_alpha = cv2.bitwise_and(fg_mask, existing_alpha)

    # Merge BGR + Alpha into true 4-channel BGRA
    b, g, r = cv2.split(bgr_img)
    return cv2.merge((b, g, r, final_alpha))
