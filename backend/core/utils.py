import cv2
import numpy as np
import base64

def decode_base64_image(base64_str: str) -> np.ndarray:
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]
    img_data = base64.b64decode(base64_str)
    np_arr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
    return img

def encode_image_base64(img: np.ndarray, use_jpeg: bool = False) -> str:
    if use_jpeg:
        # Strip alpha channel for JPEG (doesn't support transparency)
        if img.ndim == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64_str = base64.b64encode(buffer.tobytes()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64_str}"
    _, buffer = cv2.imencode('.png', img)
    b64_str = base64.b64encode(buffer.tobytes()).decode('utf-8')
    return f"data:image/png;base64,{b64_str}"

def hex_to_rgb(hex_color: str):
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return (255, 255, 255)
