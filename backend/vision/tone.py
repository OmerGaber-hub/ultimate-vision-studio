import cv2
import numpy as np

def process_tone_adjustments(img: np.ndarray, config: dict) -> np.ndarray:
    a = None
    has_alpha = img.ndim == 3 and img.shape[2] == 4
    if has_alpha:
        b, g, r, a = cv2.split(img)
        rgb_img = cv2.merge((b, g, r))
    else:
        rgb_img = img.copy()

    result = rgb_img.astype(np.float32)

    # 1. Exposure
    exposure = config.get("exposure", 0)
    if exposure != 0:
        factor = 2 ** (exposure / 100.0)
        result *= factor

    # 2. Brightness
    brightness = config.get("brightness", 0)
    if brightness != 0:
        result += brightness

    # 3. Contrast
    contrast = config.get("contrast", 0)
    if contrast != 0:
        c_factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast))
        result = c_factor * (result - 128.0) + 128.0

    result = np.clip(result, 0, 255)

    # 4. Saturation
    saturation = config.get("saturation", 0)
    if saturation != 0:
        hsv = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
        s_factor = 1.0 + (saturation / 100.0)
        hsv[:, :, 1] *= s_factor
        hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
        result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)

    # 5. Highlights and Shadows
    highlights = config.get("highlights", 0)
    shadows = config.get("shadows", 0)
    if highlights != 0 or shadows != 0:
        hls = cv2.cvtColor(result.astype(np.uint8), cv2.COLOR_BGR2HLS).astype(np.float32)
        L = hls[:, :, 1]
        
        # Shadows (affects darker regions, L < 128)
        if shadows != 0:
            shadow_mask = (128.0 - L) / 128.0
            shadow_mask[shadow_mask < 0] = 0
            L += shadows * shadow_mask
            
        # Highlights (affects brighter regions, L > 128)
        if highlights != 0:
            highlight_mask = (L - 128.0) / 128.0
            highlight_mask[highlight_mask < 0] = 0
            L += highlights * highlight_mask
            
        hls[:, :, 1] = np.clip(L, 0, 255)
        result = cv2.cvtColor(hls.astype(np.uint8), cv2.COLOR_HLS2BGR).astype(np.float32)

    # 6. Light Balance (Temperature/Tint simple approx via RGB channels)
    light_balance = config.get("lightBalance", 0)
    if light_balance != 0:
        # positive -> warmer (red/yellow), negative -> cooler (blue)
        result[:, :, 2] += light_balance # Red
        result[:, :, 0] -= light_balance # Blue

    result = np.clip(result, 0, 255).astype(np.uint8)

    if has_alpha and a is not None:
        b, g, r = cv2.split(result)
        final_img = cv2.merge((b, g, r, a))
    else:
        final_img = result

    return final_img
