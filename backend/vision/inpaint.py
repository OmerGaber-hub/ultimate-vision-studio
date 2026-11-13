"""
Smart Object Eraser - AI Inpainting Module
Uses OpenCV's inpainting algorithms (Navier-Stokes / Telea) to intelligently
remove objects from images and reconstruct the background texture.
"""
import cv2
import numpy as np
from typing import Optional, Any


def process_inpaint(img: np.ndarray, mask_base64_or_array: Any, config: Optional[dict[str, Any]] = None) -> np.ndarray:
    """
    Inpaints (removes objects from) an image using a binary mask.
    
    Args:
        img: Input image (BGR or BGRA, from OpenCV decode).
        mask_base64_or_array: Binary mask as numpy array (single-channel uint8).
                              White (255) = area to inpaint/remove.
                              Black (0) = area to keep.
        config: Optional configuration dict with:
            - method: 'telea' (default) or 'ns' (Navier-Stokes)
            - radius: Inpainting radius in pixels (default 5)
            - dilate: Dilate mask by N pixels to ensure full coverage (default 3)
    
    Returns:
        Inpainted image as numpy array (same format as input).
    """
    if config is None:
        config = {}
    
    method_name = config.get("method", "telea").lower()
    radius = int(config.get("radius", 5))
    dilate_px = int(config.get("dilate", 3))
    
    # Select OpenCV inpainting method
    if method_name == "ns" or method_name == "navier_stokes":
        cv_method = cv2.INPAINT_NS
    else:
        cv_method = cv2.INPAINT_TELEA
    
    # Ensure mask is single-channel uint8
    mask = mask_base64_or_array
    if mask is None or mask.size == 0:
        return img
    
    if len(mask.shape) == 3:
        # If mask is multi-channel, convert to grayscale and combine with alpha
        if mask.shape[2] == 4:
            gray = cv2.cvtColor(mask[:, :, :3], cv2.COLOR_BGR2GRAY)
            alpha = mask[:, :, 3]
            mask = cv2.max(gray, alpha)
        else:
            mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
    
    # Threshold to binary (any painted pixel > 10 is considered part of the mask)
    _, mask = cv2.threshold(mask, 10, 255, cv2.THRESH_BINARY)
    
    # Resize mask to match image if needed
    if mask.shape[:2] != img.shape[:2]:
        mask = cv2.resize(mask, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    
    # Check if there are any pixels to inpaint
    if np.count_nonzero(mask) == 0:
        return img

    # Dilate mask slightly to ensure complete object coverage and smooth boundaries
    if dilate_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1))
        mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Handle alpha channel: work on BGR only, preserve alpha
    has_alpha = len(img.shape) == 3 and img.shape[2] == 4
    if has_alpha:
        bgr = img[:, :, :3]
        alpha = img[:, :, 3]
    else:
        bgr = img
        alpha = None
    
    # Apply OpenCV inpainting
    result_bgr = cv2.inpaint(bgr, mask, radius, cv_method)
    
    # Recombine with alpha if needed
    if has_alpha and alpha is not None:
        # Also restore alpha in inpainted areas to fully opaque
        alpha_result = alpha.copy()
        alpha_result[mask == 255] = 255
        result = cv2.merge([result_bgr[:, :, 0], result_bgr[:, :, 1], result_bgr[:, :, 2], alpha_result])
    else:
        result = result_bgr
    
    return result
