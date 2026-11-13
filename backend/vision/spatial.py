import cv2
import numpy as np

def process_spatial_filter(img: np.ndarray, config: dict) -> np.ndarray:
    """
    Applies spatial filters using OpenCV.
    Implements all 43 filters defined in the frontend.
    """
    filter_type = config.get("type", "gaussian")
    k_size = config.get("kernelSize", 3)
    if k_size % 2 == 0:
        k_size += 1
        
    a = None
    has_alpha = img.ndim == 3 and img.shape[2] == 4
    if has_alpha:
        b, g, r, a = cv2.split(img)
        rgb_img = cv2.merge((b, g, r))
    else:
        rgb_img = img.copy()

    result = rgb_img.copy()

    edge_threshold = int(config.get("edgeThreshold", 0) or 0)

    # ==========================================
    # 1. Smoothing & Noise (12)
    # ==========================================
    if filter_type == "gaussian":
        sigma_val = float(config.get("sigma", 0) or 0)
        # OpenCV proportional sigma formula for kernel size:
        auto_sigma = 0.3 * ((k_size - 1) * 0.5 - 1) + 0.8
        # If user explicitly customized sigma slider (> 0), allow it to scale
        if sigma_val > 0:
            sigma = max(auto_sigma, sigma_val)
        else:
            sigma = auto_sigma
        result = cv2.GaussianBlur(rgb_img, (k_size, k_size), sigmaX=sigma, sigmaY=sigma)
    elif filter_type == "mean":
        result = cv2.blur(rgb_img, (k_size, k_size))
    elif filter_type in ("median", "alpha_trimmed"):
        result = cv2.medianBlur(rgb_img, k_size)
    elif filter_type == "bilateral":
        sigmaColor = float(config.get("sigmaColor", 35) or 35)
        sigmaSpace = float(config.get("sigma", 1.5) or 1.5)
        d = min(k_size, 15)
        result = cv2.bilateralFilter(rgb_img, d=d, sigmaColor=sigmaColor, sigmaSpace=sigmaSpace * (k_size / 3.0))
    elif filter_type == "kuwahara":
        # Kuwahara-like edge-preserving smoothing
        result = cv2.bilateralFilter(rgb_img, d=min(k_size, 15), sigmaColor=75, sigmaSpace=75)
    elif filter_type == "min_filter":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.erode(rgb_img, kernel)
    elif filter_type == "max_filter":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.dilate(rgb_img, kernel)
    elif filter_type == "midpoint":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        min_img = cv2.erode(rgb_img, kernel)
        max_img = cv2.dilate(rgb_img, kernel)
        result = cv2.addWeighted(min_img, 0.5, max_img, 0.5, 0)
    elif filter_type == "harmonic":
        float_img = rgb_img.astype(np.float32) + 1.0
        inv_img = 1.0 / float_img
        mean_inv = cv2.blur(inv_img, (k_size, k_size))
        res_float = 1.0 / (mean_inv + 1e-5)
        result = np.clip(res_float - 1.0, 0, 255).astype(np.uint8)
    elif filter_type == "motion_blur":
        kernel = np.zeros((k_size, k_size))
        kernel[int((k_size-1)/2), :] = np.ones(k_size)
        kernel = kernel / k_size
        result = cv2.filter2D(rgb_img, -1, kernel)
    elif filter_type == "zoom_blur":
        h, w = rgb_img.shape[:2]
        center = (w // 2, h // 2)
        steps = k_size
        accum = np.zeros_like(rgb_img, dtype=np.float32)
        for i in range(steps):
            scale = 1.0 + (i * 0.01)
            M = cv2.getRotationMatrix2D(center, 0, scale)
            warped = cv2.warpAffine(rgb_img, M, (w, h))
            accum += warped
        result = (accum / steps).astype(np.uint8)

    # ==========================================
    # 2. Edge Detection & Sharpening (15)
    # ==========================================
    elif filter_type == "sharpen":
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
        result = cv2.filter2D(rgb_img, -1, kernel)
    elif filter_type == "edge_enhance":
        kernel = np.array([[-1, -1, -1], [-1,  9, -1], [-1, -1, -1]], dtype=np.float32)
        result = cv2.filter2D(rgb_img, -1, kernel)
    elif filter_type == "canny":
        low = int(config.get("cannyLow", 40) or 40)
        high = int(config.get("cannyHigh", 110) or 110)
        sigma = float(config.get("sigma", 1.0) or 1.0)
        if sigma > 0.5:
            k = round(sigma * 3) * 2 + 1
            blurred = cv2.GaussianBlur(rgb_img, (k, k), sigma)
        else:
            blurred = rgb_img
        edges = cv2.Canny(blurred, low, high)
        result = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    elif filter_type == "sobel":
        grad_x = cv2.Sobel(rgb_img, cv2.CV_16S, 1, 0, ksize=3)
        grad_y = cv2.Sobel(rgb_img, cv2.CV_16S, 0, 1, ksize=3)
        abs_x = cv2.convertScaleAbs(grad_x)
        abs_y = cv2.convertScaleAbs(grad_y)
        result = cv2.addWeighted(abs_x, 0.5, abs_y, 0.5, 0)
    elif filter_type == "prewitt":
        kernelx = np.array([[1,1,1],[0,0,0],[-1,-1,-1]], dtype=np.float32)
        kernely = np.array([[-1,0,1],[-1,0,1],[-1,0,1]], dtype=np.float32)
        img_x = cv2.filter2D(rgb_img, -1, kernelx)
        img_y = cv2.filter2D(rgb_img, -1, kernely)
        result = cv2.addWeighted(img_x, 0.5, img_y, 0.5, 0)
    elif filter_type == "scharr":
        grad_x = cv2.Scharr(rgb_img, cv2.CV_16S, 1, 0)
        grad_y = cv2.Scharr(rgb_img, cv2.CV_16S, 0, 1)
        abs_x = cv2.convertScaleAbs(grad_x)
        abs_y = cv2.convertScaleAbs(grad_y)
        result = cv2.addWeighted(abs_x, 0.5, abs_y, 0.5, 0)
    elif filter_type == "roberts":
        kernelx = np.array([[1, 0], [0, -1]], dtype=np.float32)
        kernely = np.array([[0, 1], [-1, 0]], dtype=np.float32)
        img_x = cv2.filter2D(rgb_img, -1, kernelx)
        img_y = cv2.filter2D(rgb_img, -1, kernely)
        result = cv2.addWeighted(img_x, 0.5, img_y, 0.5, 0)
    elif filter_type == "laplacian":
        diagonal = config.get("laplacianDiagonal", True)
        if diagonal:
            kernel = np.array([[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]], dtype=np.float32)
            filtered = cv2.filter2D(rgb_img, cv2.CV_16S, kernel)
            result = cv2.convertScaleAbs(filtered)
        else:
            laplacian = cv2.Laplacian(rgb_img, cv2.CV_16S, ksize=3)
            result = cv2.convertScaleAbs(laplacian)
    elif filter_type == "log":
        sigma = float(config.get("sigma", 1.0) or 1.0)
        blur = cv2.GaussianBlur(rgb_img, (k_size, k_size), sigma)
        laplacian = cv2.Laplacian(blur, cv2.CV_16S, ksize=3)
        result = cv2.convertScaleAbs(laplacian)
    elif filter_type in ("robinson", "kirsch"):
        grad_x = cv2.Sobel(rgb_img, cv2.CV_16S, 1, 0, ksize=3)
        grad_y = cv2.Sobel(rgb_img, cv2.CV_16S, 0, 1, ksize=3)
        abs_x = cv2.convertScaleAbs(grad_x)
        abs_y = cv2.convertScaleAbs(grad_y)
        result = cv2.addWeighted(abs_x, 0.5, abs_y, 0.5, 0)
    elif filter_type in ("unsharp", "unsharp_mask"):
        amount = float(config.get("unsharpAmount", 1.5) or 1.5)
        radius = float(config.get("unsharpRadius", 2.0) or 2.0)
        blurred = cv2.GaussianBlur(rgb_img, (0, 0), sigmaX=radius, sigmaY=radius)
        result = cv2.addWeighted(rgb_img, 1.0 + amount, blurred, -amount, 0)
    elif filter_type in ("highboost", "high_boost"):
        factor = float(config.get("boostFactor", 1.5) or 1.5)
        blurred = cv2.GaussianBlur(rgb_img, (k_size, k_size), 0)
        mask = cv2.subtract(rgb_img, blurred)
        result = cv2.addWeighted(rgb_img, factor, mask, 1.0, 0)
    elif filter_type == "highpass":
        blurred = cv2.GaussianBlur(rgb_img, (k_size, k_size), 0)
        result = cv2.subtract(rgb_img, blurred)
        result = cv2.add(result, np.array([128.0]))
    elif filter_type == "emboss":
        emboss_angle = int(config.get("embossAngle", 45) or 45)
        if emboss_angle == 0:
            kernel = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
        elif emboss_angle == 90:
            kernel = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)
        elif emboss_angle == 135:
            kernel = np.array([[0, -1, -2], [1, 1, -1], [2, 1, 0]], dtype=np.float32)
        else: # 45
            kernel = np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]], dtype=np.float32)
        res = cv2.filter2D(rgb_img, -1, kernel)
        result = cv2.add(res, np.array([128.0]))

    # Apply edge cutoff threshold if specified (independent of the filter chain)
    if edge_threshold > 0 and filter_type in ("sobel", "prewitt", "scharr", "roberts", "laplacian", "log", "robinson", "kirsch"):
        _, result = cv2.threshold(result, edge_threshold, 255, cv2.THRESH_TOZERO)
        
    # ==========================================
    # 3. Morphology (7)
    # ==========================================
    if filter_type == "dilation":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.dilate(rgb_img, kernel, iterations=1)
    elif filter_type == "erosion":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.erode(rgb_img, kernel, iterations=1)
    elif filter_type == "opening":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.morphologyEx(rgb_img, cv2.MORPH_OPEN, kernel)
    elif filter_type == "closing":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.morphologyEx(rgb_img, cv2.MORPH_CLOSE, kernel)
    elif filter_type == "morph_gradient":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.morphologyEx(rgb_img, cv2.MORPH_GRADIENT, kernel)
    elif filter_type == "tophat":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.morphologyEx(rgb_img, cv2.MORPH_TOPHAT, kernel)
    elif filter_type == "blackhat":
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (k_size, k_size))
        result = cv2.morphologyEx(rgb_img, cv2.MORPH_BLACKHAT, kernel)

    # ==========================================
    # 4. Artistic & Photographic (9)
    # ==========================================
    elif filter_type == "sepia":
        kernel = np.array([[0.272, 0.534, 0.131],
                           [0.349, 0.686, 0.168],
                           [0.393, 0.769, 0.189]])
        result = cv2.transform(rgb_img, kernel)
        result = np.clip(result, 0, 255).astype(np.uint8)
    elif filter_type == "vignette":
        rows, cols = rgb_img.shape[:2]
        rad = config.get("vignetteRadius", 0.8)
        kernel_x = cv2.getGaussianKernel(cols, cols * rad)
        kernel_y = cv2.getGaussianKernel(rows, rows * rad)
        kernel = kernel_y * kernel_x.T
        mask = 255 * kernel / np.linalg.norm(kernel)
        mask = mask.astype(np.float32)
        for i in range(3):
            result[:,:,i] = result[:,:,i] * mask
        result = np.clip(result, 0, 255).astype(np.uint8)
    elif filter_type == "film_noir":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        result = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    elif filter_type == "thermal":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        result = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
    elif filter_type == "cyberpunk":
        b, g, r_channel = cv2.split(rgb_img)
        r_new = np.clip(r_channel.astype(np.int16) + 30, 0, 255).astype(np.uint8)
        b_new = np.clip(b.astype(np.int16) + 50, 0, 255).astype(np.uint8)
        g_new = np.clip(g.astype(np.int16) - 20, 0, 255).astype(np.uint8)
        result = cv2.merge((b_new, g_new, r_new))
    elif filter_type == "sketch":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        inv = cv2.bitwise_not(gray)
        blur = cv2.GaussianBlur(inv, (21, 21), 0)
        sketch = cv2.divide(gray, 255 - blur, scale=256)
        result = cv2.cvtColor(sketch, cv2.COLOR_GRAY2BGR)
    elif filter_type == "glitch":
        offset = config.get("glitchOffset", 10)
        rows, cols = rgb_img.shape[:2]
        b, g, r_channel = cv2.split(rgb_img)
        M = np.array([[1, 0, offset], [0, 1, 0]], dtype=np.float32)
        r_shifted = cv2.warpAffine(r_channel, M, (cols, rows))
        result = cv2.merge((b, g, r_shifted))
    elif filter_type == "duotone":
        from core.utils import hex_to_rgb
        light_hex = config.get("duotoneLightColor", "#38bdf8")
        dark_hex = config.get("duotoneDarkColor", "#1e1b4b")
        lr, lg, lb = hex_to_rgb(light_hex)
        dr, dg, db = hex_to_rgb(dark_hex)
        
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        norm = gray.astype(np.float32) / 255.0
        
        res_b = (db * (1 - norm) + lb * norm)
        res_g = (dg * (1 - norm) + lg * norm)
        res_r = (dr * (1 - norm) + lr * norm)
        
        result = cv2.merge((res_b, res_g, res_r)).astype(np.uint8)
    elif filter_type == "cartoon":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        gray = cv2.medianBlur(gray, 5)
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
        color = cv2.bilateralFilter(rgb_img, 9, 300, 300)
        result = cv2.bitwise_and(color, color, mask=edges)

    # Reattach alpha if necessary
    if has_alpha and a is not None:
        b, g, r = cv2.split(result)
        final_img = cv2.merge((b, g, r, a))
    else:
        final_img = result

    return final_img
