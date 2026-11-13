import os
import json
import asyncio
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Header, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import Optional
from dotenv import load_dotenv

from core.utils import decode_base64_image, encode_image_base64
from vision.spatial import process_spatial_filter
from vision.segmentation import process_segmentation
from vision.point import process_point_operation
from vision.tone import process_tone_adjustments
from vision.background import process_bg_removal, get_rembg_session
from vision.inpaint import process_inpaint
from vision.vector import trace_image_to_svg
from ai_engine import analyze_image_with_ai

from db.database import init_db
from services.auth_service import register_user, authenticate_user, verify_token, get_user_by_id
from services.storage_service import (
    save_project,
    list_projects,
    get_project,
    delete_project,
    save_user_asset,
    list_user_assets,
    get_asset_file,
    delete_user_asset
)

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database on startup
    init_db()
    # Pre-warm AI Background Removal model in background thread
    def _warmup_bg():
        try:
            get_rembg_session()
            print("[Vision Studio API] AI Background Removal model pre-warmed successfully.")
        except Exception as e:
            print(f"[Vision Studio API] BG Pre-warm notice: {e}")
    threading.Thread(target=_warmup_bg, daemon=True).start()
    yield

app = FastAPI(title="Ultimate Vision Studio API", lifespan=lifespan)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Pydantic Request Models -----------------

class AIAnalyzeRequest(BaseModel):
    imageBase64: str
    mode: str
    confidence: Optional[float] = 0.25
    modelName: Optional[str] = "yolo11s.pt"

class OCRAnalyzeRequest(BaseModel):
    imageBase64: str
    languages: list[str] = ["ar", "en"]
    enhance: bool = True

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    identifier: str
    password: str

class SaveProjectRequest(BaseModel):
    title: str
    docWidth: int
    docHeight: int
    layersData: str
    thumbnailUrl: str
    projectId: Optional[str] = None

# ----------------- Auth Dependency -----------------

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Verifies Bearer token and returns authenticated user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="يرجى تسجيل الدخول أولاً للوصول إلى هذه الميزة")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً")
    user = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="المستخدم غير موجود")
    return user

# ----------------- Basic Endpoints -----------------

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "offline": True,
        "yolo": "YOLO11s",
        "ocr": "EasyOCR",
        "backend": "FastAPI",
        "auth": "Enabled",
        "database": "SQLite"
    }

@app.post("/api/vision-ai/analyze")
def analyze_vision(req: AIAnalyzeRequest):
    conf = req.confidence if req.confidence is not None else 0.25
    model = req.modelName if req.modelName else "yolo11s.pt"
    result = analyze_image_with_ai(req.imageBase64, req.mode, conf_threshold=conf, model_name=model)
    return result

@app.post("/api/vision-ai/ocr")
def analyze_ocr(req: OCRAnalyzeRequest):
    from vision.ocr import process_ocr
    img = decode_base64_image(req.imageBase64)
    result = process_ocr(img, req.languages, req.enhance)
    return result

# ----------------- Authentication Endpoints -----------------

@app.post("/api/auth/register")
def api_register(req: RegisterRequest):
    try:
        user = register_user(req.username, req.email, req.password)
        return {"success": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء إنشاء الحساب: {str(e)}")

@app.post("/api/auth/login")
def api_login(req: LoginRequest):
    try:
        user = authenticate_user(req.identifier, req.password)
        return {"success": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"حدث خطأ أثناء تسجيل الدخول: {str(e)}")

@app.get("/api/auth/me")
def api_me(user: dict = Depends(get_current_user)):
    return {"success": True, "user": user}

# ----------------- User Manual Download Endpoint -----------------

@app.get("/api/manual/download")
def download_user_manual():
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Ultimate_Vision_Studio_User_Manual.pdf"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "Ultimate_Vision_Studio_User_Manual.pdf"),
        os.path.abspath("Ultimate_Vision_Studio_User_Manual.pdf"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "Ultimate_Vision_Studio_User_Manual.pdf"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return FileResponse(
                p,
                filename="Ultimate_Vision_Studio_User_Manual.pdf",
                media_type="application/pdf",
                headers={"Content-Disposition": "attachment; filename=Ultimate_Vision_Studio_User_Manual.pdf"}
            )
    raise HTTPException(status_code=404, detail="دليل المستخدم غير موجود حالياً")

# ----------------- Cloud Projects Endpoints -----------------

@app.get("/api/projects")
def api_list_projects(user: dict = Depends(get_current_user)):
    projects = list_projects(user["id"])
    return {"success": True, "projects": projects}

@app.post("/api/projects")
def api_save_project(req: SaveProjectRequest, user: dict = Depends(get_current_user)):
    try:
        saved = save_project(
            user_id=user["id"],
            title=req.title,
            doc_width=req.docWidth,
            doc_height=req.docHeight,
            layers_data=req.layersData,
            thumbnail_url=req.thumbnailUrl,
            project_id=req.projectId
        )
        return {"success": True, "project": saved}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشل حفظ المشروع: {str(e)}")

@app.get("/api/projects/{project_id}")
def api_get_project(project_id: str, user: dict = Depends(get_current_user)):
    proj = get_project(user["id"], project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    return {"success": True, "project": proj}

@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: str, user: dict = Depends(get_current_user)):
    ok = delete_project(user["id"], project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    return {"success": True, "deleted": True}

# ----------------- User Vault Assets Endpoints -----------------

@app.get("/api/assets")
def api_list_assets(user: dict = Depends(get_current_user)):
    assets = list_user_assets(user["id"])
    return {"success": True, "assets": assets}

@app.post("/api/assets/upload")
async def api_upload_asset(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        content = await file.read()
        mime = file.content_type or "image/png"
        asset = save_user_asset(user["id"], file.filename or "image.png", content, mime)
        return {"success": True, "asset": asset}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشل رفع الصورة: {str(e)}")

@app.get("/api/assets/{asset_id}/raw")
def api_get_asset_raw(asset_id: str, token: Optional[str] = None, authorization: Optional[str] = Header(None)):
    auth_token = token
    if not auth_token and authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    if not auth_token:
        raise HTTPException(status_code=401, detail="غير مصرح")
    payload = verify_token(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="رمز غير صالح")
        
    file_info = get_asset_file(payload["sub"], asset_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    path, filename, mime = file_info
    return FileResponse(path, media_type=mime, filename=filename)

@app.delete("/api/assets/{asset_id}")
def api_delete_asset(asset_id: str, user: dict = Depends(get_current_user)):
    ok = delete_user_asset(user["id"], asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="الملف غير موجود")
    return {"success": True, "deleted": True}

@app.websocket("/ws/vision")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            action = payload.get("action")
            req_id = payload.get("requestId")
            
            def make_response(data_dict: dict) -> str:
                if req_id is not None:
                    data_dict["requestId"] = req_id
                return json.dumps(data_dict)
            
            if action == "apply_spatial_filter":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config")
                if not isinstance(config, dict):
                    config = {}
                is_preview = payload.get("isPreview", False)
                if image_base64:
                    try:
                        img = decode_base64_image(image_base64)
                        processed_img = await asyncio.to_thread(process_spatial_filter, img, config)
                        out_base64 = encode_image_base64(processed_img, use_jpeg=is_preview)
                        await websocket.send_text(make_response({
                            "type": "spatial_filter_result",
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        print(f"Spatial Filter Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "spatial_filter_result",
                            "error": str(e)
                        }))
                    
            elif action == "apply_segmentation":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config")
                is_preview = payload.get("isPreview", False)
                if image_base64 and config:
                    try:
                        img = decode_base64_image(image_base64)
                        processed_img, segments = await asyncio.to_thread(process_segmentation, img, config, is_preview)
                        out_base64 = encode_image_base64(processed_img, use_jpeg=is_preview)
                        await websocket.send_text(make_response({
                            "type": "segmentation_result",
                            "imageBase64": out_base64,
                            "segments": segments
                        }))
                    except Exception as e:
                        print(f"Segmentation Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "segmentation_error",
                            "error": str(e)
                        }))
                        
            elif action == "apply_point_processing":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config")
                is_preview = payload.get("isPreview", False)
                if image_base64 and config:
                    try:
                        img = decode_base64_image(image_base64)
                        processed_img = await asyncio.to_thread(process_point_operation, img, config)
                        out_base64 = encode_image_base64(processed_img, use_jpeg=is_preview)
                        await websocket.send_text(make_response({
                            "type": "point_processing_result",
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        print(f"Point Processing Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "point_processing_result",
                            "error": str(e)
                        }))
                    
            elif action == "apply_tone_adjustments":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config")
                is_preview = payload.get("isPreview", False)
                if image_base64 and config:
                    try:
                        img = decode_base64_image(image_base64)
                        processed_img = await asyncio.to_thread(process_tone_adjustments, img, config)
                        out_base64 = encode_image_base64(processed_img, use_jpeg=is_preview)
                        await websocket.send_text(make_response({
                            "type": "tone_adjustments_result",
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        print(f"Tone Adjustments Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "tone_adjustments_result",
                            "error": str(e)
                        }))
                    
            elif action == "apply_bg_removal":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config", {})
                if not image_base64:
                    await websocket.send_text(make_response({
                        "type": "bg_removal_error",
                        "error": "لم يتم إرسال بيانات الصورة لإزالة الخلفية"
                    }))
                else:
                    try:
                        img = decode_base64_image(image_base64)
                        if img is None or img.size == 0:
                            raise ValueError("فشل في فك ترميز بيانات الصورة")
                        processed_img = await asyncio.to_thread(process_bg_removal, img, config)
                        out_base64 = encode_image_base64(processed_img)
                        await websocket.send_text(make_response({
                            "type": "bg_removal_result",
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        print(f"Background Removal Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "bg_removal_error",
                            "error": str(e)
                        }))
                    
            elif action == "trace_svg":
                image_base64 = payload.get("imageBase64")
                config = payload.get("config")
                if image_base64 and config:
                    try:
                        img = decode_base64_image(image_base64)
                        svg_string = await asyncio.to_thread(trace_image_to_svg, img, config)
                        await websocket.send_text(make_response({
                            "type": "trace_svg_result",
                            "svg": svg_string
                        }))
                    except Exception as e:
                        print(f"Trace SVG Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "trace_svg_result",
                            "error": str(e)
                        }))
                    
            elif action == "apply_inpaint":
                image_base64 = payload.get("imageBase64")
                mask_base64 = payload.get("maskBase64")
                config = payload.get("config", {})
                if image_base64 and mask_base64:
                    try:
                        img = decode_base64_image(image_base64)
                        mask = decode_base64_image(mask_base64)
                        if img is None or img.size == 0:
                            raise ValueError("فشل في فك ترميز الصورة الأصلية")
                        if mask is None or mask.size == 0:
                            raise ValueError("فشل في فك ترميز قناع المسح")
                        result_img = await asyncio.to_thread(process_inpaint, img, mask, config)
                        out_base64 = encode_image_base64(result_img)
                        await websocket.send_text(make_response({
                            "type": "inpaint_result",
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        print(f"Inpaint Error: {e}")
                        await websocket.send_text(make_response({
                            "type": "inpaint_result",
                            "error": str(e)
                        }))
                else:
                    await websocket.send_text(make_response({
                        "type": "inpaint_result",
                        "error": "يرجى إرسال الصورة الأصلية وقناع المسح"
                    }))
                    
            elif action == "run_python_script":
                script = payload.get("script")
                image_base64 = payload.get("imageBase64")
                if script and image_base64:
                    try:
                        import cv2
                        import numpy as np
                        import tempfile
                        import os
                        
                        img = decode_base64_image(image_base64)
                        
                        # Use a temporary directory to simulate local execution
                        with tempfile.TemporaryDirectory() as tmpdir:
                            input_path = os.path.join(tmpdir, "input.jpg")
                            output_path = os.path.join(tmpdir, "output.jpg")
                            
                            # Write the input image
                            cv2.imwrite(input_path, img)
                            
                            # Execute the script to define process_image
                            local_vars: dict = {"cv2": cv2, "np": np}
                            exec(script, globals(), local_vars)
                            
                            # Call the generated function
                            process_fn = local_vars.get("process_image")
                            if callable(process_fn):
                                process_fn(input_path, output_path)
                                
                                # Read the result
                                if os.path.exists(output_path):
                                    result_img = cv2.imread(output_path)
                                else:
                                    result_img = img
                            else:
                                result_img = img
                                
                        out_base64 = encode_image_base64(result_img)
                        await websocket.send_text(make_response({
                            "type": "python_script_result",
                            "success": True,
                            "imageBase64": out_base64
                        }))
                    except Exception as e:
                        await websocket.send_text(make_response({
                            "type": "python_script_result",
                            "success": False,
                            "error": str(e)
                        }))
    except WebSocketDisconnect:
        print("Client disconnected from WebSocket")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
