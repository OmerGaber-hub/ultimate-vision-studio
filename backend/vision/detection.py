import os
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

# Singleton cache for YOLO models
_models: Dict[str, Any] = {}

# Comprehensive Arabic translations for 80 MS COCO classes
COCO_ARABIC: Dict[str, str] = {
    "person": "شخص",
    "bicycle": "دراجة هوائية",
    "car": "سيارة",
    "motorcycle": "دراجة نارية",
    "airplane": "طائرة",
    "bus": "حافلة",
    "train": "قطار",
    "truck": "شاحنة",
    "boat": "قارب",
    "traffic light": "إشارة مرور",
    "fire hydrant": "صنبور إطفاء",
    "stop sign": "علامة توقف",
    "parking meter": "عداد مواقف",
    "bench": "مقعد عام",
    "bird": "طائر",
    "cat": "قطة",
    "dog": "كلب",
    "horse": "حصان",
    "sheep": "خروف",
    "cow": "بقرة",
    "elephant": "فيل",
    "bear": "دب",
    "zebra": "حمار وحشي",
    "giraffe": "زرافة",
    "backpack": "حقيبة ظهر",
    "umbrella": "مظلة",
    "handbag": "حقيبة يد",
    "tie": "ربطة عنق",
    "suitcase": "حقيبة سفر",
    "frisbee": "قرص طائر",
    "skis": "زلاجات ثلج",
    "snowboard": "لوح تزلج ثلجي",
    "sports ball": "كرة رياضية",
    "kite": "طائرة ورقية",
    "baseball bat": "مضرب بيسبول",
    "baseball glove": "قفاز بيسبول",
    "skateboard": "لوح تزلج",
    "surfboard": "لوح ركوب أمواج",
    "tennis racket": "مضرب تنس",
    "bottle": "زجاجة / قارورة",
    "wine glass": "كأس زجاجي",
    "cup": "كوب / فنجان",
    "fork": "شوكة",
    "knife": "سكين",
    "spoon": "ملعقة",
    "bowl": "وعاء / صحن عميق",
    "banana": "موز",
    "apple": "تفاح",
    "sandwich": "شطيرة / ساندويتش",
    "orange": "برتقال",
    "broccoli": "بروكلي",
    "carrot": "جزر",
    "hot dog": "هوت دوج",
    "pizza": "بيتزا",
    "donut": "دونات",
    "cake": "كعكة / تورتة",
    "chair": "كرسي",
    "couch": "أريكة / كنب",
    "potted plant": "نبتة زينة",
    "bed": "سرير",
    "dining table": "طاولة طعام",
    "toilet": "مرحاض",
    "tv": "شاشة / تلفاز",
    "laptop": "حاسوب محمول (لابتوب)",
    "mouse": "فأرة حاسوب",
    "remote": "جهاز تحكم (ريموت)",
    "keyboard": "لوحة مفاتيح",
    "cell phone": "هاتف محمول",
    "microwave": "مايكروويف",
    "oven": "فرن",
    "toaster": "محمصة خبز",
    "sink": "حوض غسيل",
    "refrigerator": "ثلاجة",
    "book": "كتاب",
    "clock": "ساعة",
    "vase": "مزهرية",
    "scissors": "مقص",
    "teddy bear": "دبدوب قماشي",
    "hair drier": "مجفف شعر",
    "toothbrush": "فرشاة أسنان",
}

# Category classification for visual badges and filtering
CLASS_CATEGORIES: Dict[str, str] = {
    "person": "person",
    "bicycle": "vehicle", "car": "vehicle", "motorcycle": "vehicle", "airplane": "vehicle",
    "bus": "vehicle", "train": "vehicle", "truck": "vehicle", "boat": "vehicle",
    "bird": "animal", "cat": "animal", "dog": "animal", "horse": "animal",
    "sheep": "animal", "cow": "animal", "elephant": "animal", "bear": "animal",
    "zebra": "animal", "giraffe": "animal",
    "backpack": "accessory", "umbrella": "accessory", "handbag": "accessory",
    "tie": "accessory", "suitcase": "accessory",
    "frisbee": "sports", "skis": "sports", "snowboard": "sports", "sports ball": "sports",
    "kite": "sports", "baseball bat": "sports", "baseball glove": "sports",
    "skateboard": "sports", "surfboard": "sports", "tennis racket": "sports",
    "bottle": "kitchen", "wine glass": "kitchen", "cup": "kitchen", "fork": "kitchen",
    "knife": "kitchen", "spoon": "kitchen", "bowl": "kitchen",
    "banana": "food", "apple": "food", "sandwich": "food", "orange": "food",
    "broccoli": "food", "carrot": "food", "hot dog": "food", "pizza": "food",
    "donut": "food", "cake": "food",
    "chair": "furniture", "couch": "furniture", "potted plant": "furniture",
    "bed": "furniture", "dining table": "furniture", "toilet": "furniture",
    "tv": "electronics", "laptop": "electronics", "mouse": "electronics",
    "remote": "electronics", "keyboard": "electronics", "cell phone": "electronics",
    "microwave": "appliance", "oven": "appliance", "toaster": "appliance",
    "sink": "appliance", "refrigerator": "appliance",
    "book": "indoor", "clock": "indoor", "vase": "indoor", "scissors": "indoor",
    "teddy bear": "indoor", "hair drier": "indoor", "toothbrush": "indoor",
    "traffic light": "outdoor", "fire hydrant": "outdoor", "stop sign": "outdoor",
    "parking meter": "outdoor", "bench": "outdoor",
}

# Category colors for bounding box highlights
CATEGORY_COLORS: Dict[str, str] = {
    "person": "#6366f1",     # Indigo
    "vehicle": "#3b82f6",    # Blue
    "animal": "#10b981",     # Emerald
    "accessory": "#ec4899",  # Pink
    "sports": "#f59e0b",     # Amber
    "kitchen": "#06b6d4",    # Cyan
    "food": "#f97316",       # Orange
    "furniture": "#8b5cf6",  # Purple
    "electronics": "#0ea5e9",# Sky
    "appliance": "#14b8a6",  # Teal
    "indoor": "#a855f7",     # Violet
    "outdoor": "#64748b",    # Slate
}

def get_yolo_model() -> Any:
    """
    Returns the cached high-accuracy YOLO11s model instance.
    """
    model_name = "yolo11s.pt"
    if model_name not in _models:
        from ultralytics import YOLO
        print(f"[YOLO11s] Loading local high-accuracy model: {model_name}...")
        _models[model_name] = YOLO(model_name)
        print(f"[YOLO11s] Model {model_name} loaded successfully!")
    return _models[model_name]

def detect_objects(
    img: np.ndarray,
    conf_threshold: float = 0.25,
    model_name: str = "yolo11s.pt"
) -> Dict[str, Any]:
    """
    Executes local YOLO11s object detection on an image.
    Returns:
      - objects: List of detected objects with label, labelAr, confidence, box2d, category, colorHex
      - totalCount: Number of detected items
      - model: YOLO11s
    """
    if img is None or img.size == 0:
        return {"success": False, "objects": [], "summary": "صورة غير صالحة."}

    model = get_yolo_model()
    selected_name = "yolo11s.pt"

    h, w = img.shape[:2]

    # Ensure 3-channel RGB format for YOLO (strip alpha if BGRA from blended canvas)
    if len(img.shape) == 3 and img.shape[2] == 4:
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGB)
    elif len(img.shape) == 3 and img.shape[2] == 3:
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    elif len(img.shape) == 2:
        rgb_img = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
    else:
        rgb_img = img

    # Run inference with given confidence
    results = model(rgb_img, conf=conf_threshold, verbose=False)

    detected_objects: List[Dict[str, Any]] = []

    if results and len(results) > 0:
        r = results[0]
        boxes = r.boxes
        if boxes is not None and len(boxes) > 0:
            for i, box in enumerate(boxes):
                # Coordinates in xyxy format
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = model.names.get(cls_id, f"object_{cls_id}")

                # Translate to Arabic
                label_ar = COCO_ARABIC.get(cls_name, cls_name)

                # Get Category & Color
                category = CLASS_CATEGORIES.get(cls_name, "other")
                color_hex = CATEGORY_COLORS.get(category, "#a855f7")

                # Normalize box2d to [ymin, xmin, ymax, xmax] (0 to 1000)
                ymin_norm = round(max(0, min(1000, (y1 / h) * 1000)))
                xmin_norm = round(max(0, min(1000, (x1 / w) * 1000)))
                ymax_norm = round(max(0, min(1000, (y2 / h) * 1000)))
                xmax_norm = round(max(0, min(1000, (x2 / w) * 1000)))

                # Pixel coordinates for cropping
                px_x = round(max(0, x1))
                px_y = round(max(0, y1))
                px_w = round(max(1, x2 - x1))
                px_h = round(max(1, y2 - y1))

                detected_objects.append({
                    "id": f"obj_{i+1}",
                    "label": cls_name,
                    "labelAr": label_ar,
                    "confidence": round(conf, 3),
                    "box2d": [ymin_norm, xmin_norm, ymax_norm, xmax_norm],
                    "boxPixels": [px_x, px_y, px_w, px_h],
                    "category": category,
                    "colorHex": color_hex,
                })

    # Sort objects by confidence descending
    detected_objects.sort(key=lambda x: x["confidence"], reverse=True)

    summary = (
        f"تم كشف {len(detected_objects)} كائن(كائنات) بنجاح بواسطة YOLO11 محلياً."
        if detected_objects else
        "لم يتم العثور على كائنات بنسبة ثقة مطابقة في الصورة."
    )

    return {
        "success": True,
        "objects": detected_objects,
        "totalCount": len(detected_objects),
        "summary": summary,
        "modelUsed": selected_name,
        "result": {
            "objects": detected_objects,
            "summary": summary
        }
    }
