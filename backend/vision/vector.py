from typing import Any
import cv2
import numpy as np

def trace_image_to_svg(img: np.ndarray, config: dict) -> str:
    """
    Traces an image into an SVG format string using OpenCV.
    Quantizes colors, extracts contours, and generates SVG path tags.
    """
    num_colors = config.get("numColors", 6)
    num_colors = max(2, min(32, num_colors))
    
    # Resize if too large to speed up processing
    max_dim = 800
    h, w = img.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
        h, w = img.shape[:2]

    # Convert to RGB (ignore alpha for tracing for simplicity)
    if img.ndim == 3 and img.shape[2] == 4:
        b, g, r, _ = cv2.split(img)
        rgb_img = cv2.merge((b, g, r))
    elif img.ndim == 2:
        rgb_img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else:
        rgb_img = img.copy()

    # K-Means Quantization
    Z = np.asarray(rgb_img.reshape((-1, 3)), dtype=np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    best_labels: Any = None
    _, label, center = cv2.kmeans(Z, num_colors, best_labels, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
    
    center = np.asarray(center, dtype=np.uint8)
    label_2d = label.reshape((h, w))
    
    svg_paths = []
    
    for k in range(num_colors):
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[label_2d == k] = 255
        
        # Smooth mask to reduce jagged edges
        mask = cv2.medianBlur(mask, 5)
        
        # Find contours
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
            
        color_hex = "#{:02x}{:02x}{:02x}".format(center[k][2], center[k][1], center[k][0])
        
        # Convert contours to SVG path strings
        path_data = []
        for cnt in contours:
            # Approximate contour to reduce points
            epsilon = 0.005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            if len(approx) < 3:
                continue
                
            pts = []
            for i, pt in enumerate(approx):
                x, y = pt[0]
                cmd = "M" if i == 0 else "L"
                pts.append(f"{cmd} {x} {y}")
            pts.append("Z")
            path_data.append(" ".join(pts))
            
        if path_data:
            d_attr = " ".join(path_data)
            svg_paths.append(f'<path d="{d_attr}" fill="{color_hex}" stroke="{color_hex}" stroke-width="1" stroke-linejoin="round" />')
            
    # Combine into final SVG string
    svg_content = "\n".join(svg_paths)
    svg_string = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="100%" height="100%">\n{svg_content}\n</svg>'
    
    return svg_string
