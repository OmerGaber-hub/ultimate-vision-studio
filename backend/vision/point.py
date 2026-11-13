import cv2
import numpy as np

def process_point_operation(img: np.ndarray, config: dict) -> np.ndarray:
    mode = config.get("mode", "negative")
    
    a = None
    has_alpha = img.ndim == 3 and img.shape[2] == 4
    if has_alpha:
        b, g, r, a = cv2.split(img)
        rgb_img = cv2.merge((b, g, r))
    else:
        rgb_img = img.copy()

    result = rgb_img.copy()
    
    if mode == "negative":
        result = cv2.bitwise_not(rgb_img)
    elif mode == "log":
        c = config.get("logC", 45.0)
        c_adjusted = c * (255.0 / np.log(256.0))
        float_img = rgb_img.astype(np.float32)
        # s = c * log(1 + r)
        res_float = (c_adjusted * np.log(1 + float_img)) / 100.0
        result = np.clip(res_float, 0, 255).astype(np.uint8)
    elif mode == "gamma":
        gamma = config.get("gamma", 1.0)
        gamma = max(0.01, gamma)
        inv_gamma = 1.0 / gamma
        table = np.array([((i / 255.0) ** gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
        result = cv2.LUT(rgb_img, table)
    elif mode == "threshold":
        th = config.get("thresholdValue", 128)
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, th, 255, cv2.THRESH_BINARY)
        result = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    elif mode == "otsu":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        result = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)
    elif mode == "hist_eq":
        # Equalize in YCrCb space to preserve colors
        ycrcb = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2YCrCb)
        ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
        result = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
    elif mode == "bit_plane":
        bit = int(config.get("bitPlaneIndex", 7))
        bit = max(0, min(7, bit))
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        mask = np.full(gray.shape, 1 << bit, dtype=np.uint8)
        plane = cv2.bitwise_and(gray, mask)
        _, binary = cv2.threshold(plane, 0, 255, cv2.THRESH_BINARY)
        result = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
    elif mode == "channel_r":
        result[:, :, 0] = 0 # B
        result[:, :, 1] = 0 # G
    elif mode == "channel_g":
        result[:, :, 0] = 0 # B
        result[:, :, 2] = 0 # R
    elif mode == "channel_b":
        result[:, :, 1] = 0 # G
        result[:, :, 2] = 0 # R
    elif mode == "channel_gray":
        gray = cv2.cvtColor(rgb_img, cv2.COLOR_BGR2GRAY)
        result = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    elif mode == "sampling":
        factor = config.get("sampleFactor", 8)
        factor = max(2, factor)
        h, w = rgb_img.shape[:2]
        small = cv2.resize(rgb_img, (w // factor, h // factor), interpolation=cv2.INTER_LINEAR)
        result = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
    elif mode == "quantization":
        levels = config.get("quantLevels", 4)
        levels = max(2, min(256, levels))
        step = 255.0 / (levels - 1)
        float_img = rgb_img.astype(np.float32)
        res_float = np.round(float_img / step) * step
        result = np.clip(res_float, 0, 255).astype(np.uint8)

    if has_alpha and a is not None:
        b, g, r = cv2.split(result)
        final_img = cv2.merge((b, g, r, a))
    else:
        final_img = result

    return final_img
