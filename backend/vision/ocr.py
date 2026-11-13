import cv2
import numpy as np
import easyocr
import re
import os
import torch
from typing import List, Dict, Any, Optional

# Maximize CPU multi-threading for PyTorch
try:
    cpu_cores = os.cpu_count() or 4
    torch.set_num_threads(cpu_cores)
except Exception:
    pass

# Cached singleton reader instances per language key
_readers: Dict[str, easyocr.Reader] = {}

def get_reader(languages: List[str]) -> easyocr.Reader:
    """
    Returns a cached EasyOCR reader instance for the specified languages.
    Avoids re-allocating deep learning models on every request.
    """
    clean_langs = sorted(list(set([l.strip().lower() for l in languages if l.strip()])))
    if not clean_langs:
        clean_langs = ["ar", "en"]
    key = "+".join(clean_langs)

    if key not in _readers:
        print(f"[EasyOCR] Initializing deep learning reader for languages: {clean_langs}")
        _readers[key] = easyocr.Reader(clean_langs, gpu=False, verbose=False)
    return _readers[key]

def preprocess_for_ocr(img: np.ndarray, enhance: bool = True) -> np.ndarray:
    """
    Preprocesses the image to maximize OCR accuracy:
    - Alpha blending over white background for transparent PNGs
    - Optional CLAHE contrast enhancement for low-contrast text
    """
    processed = img.copy()

    # Handle 4-channel RGBA images (blend over white background)
    if processed.ndim == 3 and processed.shape[2] == 4:
        alpha = processed[:, :, 3] / 255.0
        rgb = processed[:, :, :3]
        white_bg = np.ones_like(rgb, dtype=np.uint8) * 255
        processed = (rgb * alpha[:, :, np.newaxis] + white_bg * (1.0 - alpha[:, :, np.newaxis])).astype(np.uint8)

    if enhance and processed.ndim == 3:
        try:
            lab = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced_lab = cv2.merge((cl, a, b))
            processed = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        except Exception as e:
            print(f"[OCR Preprocessing] Warning: {e}")

    return processed

def detect_text_language(text: str) -> str:
    """
    Determines if text contains Arabic characters or Latin/numeric characters.
    """
    if re.search(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text):
        return "ar"
    return "en"

def process_ocr(img: np.ndarray, languages: Optional[List[str]] = None, enhance: bool = True) -> Dict[str, Any]:
    """
    Performs real, local, offline OCR using EasyOCR deep neural network models.
    Returns normalized bounding boxes, confidence, text blocks, and full combined text.
    """
    if img is None:
        return {
            "success": False,
            "engine": "EasyOCR (Local Deep Learning)",
            "ocr": [],
            "blocks": [],
            "fullText": "",
            "totalBlocks": 0,
            "error": "فشل في فك تشفير بيانات الصورة"
        }

    if languages is None or len(languages) == 0:
        languages = ["ar", "en"]

    reader = get_reader(languages)
    processed_img = preprocess_for_ocr(img, enhance=enhance)

    h_orig, w_orig = processed_img.shape[:2]
    if h_orig == 0 or w_orig == 0:
        return {"success": False, "ocr": [], "blocks": [], "fullText": "", "error": "Invalid image dimensions"}

    # Smart dynamic downscaling for CPU inference speedup:
    # High-res canvases (e.g. 2000px+) take 15-20s on CPU without downscaling.
    # Capping max dimension to 1200px retains full text clarity while speeding up CRAFT by 3x-5x!
    max_dim = max(h_orig, w_orig)
    if max_dim > 1200:
        scale = 1200.0 / float(max_dim)
        ocr_input = cv2.resize(
            processed_img,
            (int(round(w_orig * scale)), int(round(h_orig * scale))),
            interpolation=cv2.INTER_AREA
        )
    else:
        ocr_input = processed_img

    h_cur, w_cur = ocr_input.shape[:2]
    canvas_size = min(1200, max(h_cur, w_cur))

    with torch.inference_mode():
        raw_results = reader.readtext(
            ocr_input,
            canvas_size=canvas_size,
            mag_ratio=1.0,
            batch_size=8,
            width_ths=0.7,
        )

    blocks: List[Dict[str, Any]] = []
    full_text_lines: List[str] = []

    for bbox, text, conf in raw_results:
        clean_text = text.strip()
        if not clean_text:
            continue

        xs = [pt[0] for pt in bbox]
        ys = [pt[1] for pt in bbox]

        min_x = max(0.0, min(xs))
        max_x = min(float(w_cur), max(xs))
        min_y = max(0.0, min(ys))
        max_y = min(float(h_cur), max(ys))

        # Box2D normalized to 0..1000 scale: [ymin, xmin, ymax, xmax]
        ymin = int(round((min_y / h_cur) * 1000.0))
        xmin = int(round((min_x / w_cur) * 1000.0))
        ymax = int(round((max_y / h_cur) * 1000.0))
        xmax = int(round((max_x / w_cur) * 1000.0))

        box_h = max_y - min_y
        suggested_font_size = max(12, int(round((box_h / h_cur) * 750.0)))
        lang = detect_text_language(clean_text)

        block = {
            "text": clean_text,
            "confidence": round(float(conf), 3),
            "box2d": [ymin, xmin, ymax, xmax],
            "language": "العربية" if lang == "ar" else "الإنجليزية",
            "langCode": lang,
            "suggestedFontSize": suggested_font_size,
            "fontColorHex": "#38bdf8" if lang == "en" else "#a855f7",
        }
        blocks.append(block)
        full_text_lines.append(clean_text)

    full_text = "\n".join(full_text_lines)

    return {
        "success": True,
        "engine": "EasyOCR (Local Deep Learning)",
        "models": ["CRAFT (Detection)", "CRNN (Recognition)"],
        "ocr": blocks,
        "blocks": blocks,
        "fullText": full_text,
        "totalBlocks": len(blocks),
    }
