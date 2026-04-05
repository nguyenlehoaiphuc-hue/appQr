# =============================
# IMPORT
# =============================
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from typing import List
from datetime import datetime
import os
import json
import zipfile
import shutil
import aiofiles
import io

from docxtpl import DocxTemplate
from PIL import Image
import google.generativeai as genai

# =============================
# CONFIG
# =============================
app = FastAPI(title="VietinBank eKYC Online", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gemini API
genai.configure(api_key="AIzaSyDgPhSSa_4ezXk71t-mOaZZ0ooC-2EFK4Y")

# Mail config
conf = ConnectionConfig(
    MAIL_USERNAME="nguyenlehoaiphuc@gmail.com",
    MAIL_PASSWORD="qfrldnzdabripocp",
    MAIL_FROM="nguyenlehoaiphuc@gmail.com",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=False
)

# =============================
# EXPORT WORD
# =============================
def export_word(data: dict, uploaded_files: list) -> str:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(BASE_DIR, "template", "MS03 De nghi mo tai khoan HKD.docx")
    output_root = os.path.join(BASE_DIR, "generated_files")

    os.makedirs(output_root, exist_ok=True)

    safe_name = data.get('business_name', 'Ho_So').replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"{safe_name}_{timestamp}"
    output_dir = os.path.join(output_root, folder_name)
    os.makedirs(output_dir, exist_ok=True)

    # Lưu ảnh
    if uploaded_files:
        for file in uploaded_files:
            save_path = os.path.join(output_dir, file.filename)
            with open(save_path, "wb") as f:
                f.write(file.file.read())

    # Tạo Word
    doc = DocxTemplate(template_path)
    clean_data = {k: str(v) if v is not None else "" for k, v in data.items()}
    doc.render(clean_data)

    output_path = os.path.join(output_dir, f"Ho_so_{safe_name}.docx")
    doc.save(output_path)

    return output_path

# =============================
# SEND MAIL
# =============================
async def send_confirmation_email(data: dict, uploaded_files: list):
    try:
        word_file = export_word(data, uploaded_files)

        if not os.path.exists(word_file):
            raise Exception("Không tạo được file Word")

        zip_path = word_file.replace(".docx", ".zip")

        with zipfile.ZipFile(zip_path, 'w') as zipf:
            zipf.write(word_file, os.path.basename(word_file))

            folder_path = os.path.dirname(word_file)
            for f in os.listdir(folder_path):
                full_path = os.path.join(folder_path, f)

                if full_path == zip_path:
                    continue

                if f.lower().endswith((".jpg", ".jpeg", ".png")):
                    zipf.write(full_path, f)

        message = MessageSchema(
            subject=f"Xác nhận hồ sơ: {data.get('business_name', '')}",
            recipients=[data.get('email')],
            body=f"Chào {data.get('owner_name', '')}, đính kèm hồ sơ của bạn.",
            subtype=MessageType.plain,
            attachments=[zip_path]
        )

        fm = FastMail(conf)
        await fm.send_message(message)

        return zip_path

    except Exception as e:
        print("Lỗi gửi mail:", e)
        return None

# =============================
# CLEANUP
# =============================
def cleanup_files(zip_path):
    try:
        folder = os.path.dirname(zip_path)
        if os.path.exists(folder):
            shutil.rmtree(folder)
    except Exception as e:
        print("Lỗi xoá file:", e)

# =============================
# ROOT
# =============================
@app.get("/")
async def root():
    return {"message": "API running"}

# =============================
# EXTRACT GPKD
# =============================
@app.post("/extract-gpkd")
async def extract_gpkd(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        image.thumbnail((1600, 1600))

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=80)
        buffer.seek(0)
        img_final = Image.open(buffer)

        model = genai.GenerativeModel("models/gemini-3.1-flash-lite-preview")

        prompt = """
        Return JSON only:
        {
            "business_name": "",
            "business_code": "",
            "issued_date": "",
            "issued_place": "",
            "business_address": "",
            "phone": "",
            "capital": "",
            "owner_name": "",
            "dob": "",
            "email": "",
            "cccd": "",
            "cccd_issued_date": "",
            "cccd_issued_place": "",
            "permanent_address": ""
        }
        """

        response = model.generate_content([prompt, img_final])

        text = response.text.strip()
        if text.startswith("```"):
            text = text.replace("```json", "").replace("```", "")

        data = json.loads(text)

        return {"success": True, "data": data}

    except Exception as e:
        return {"success": False, "error": str(e)}

# =============================
# SUBMIT FORM
# =============================
@app.post("/submit-form")
async def submit_form(
    payload: str = Form(...),
    background_tasks: BackgroundTasks = None,
    files: List[UploadFile] = File(default=[])
):
    try:
        payload_dict = json.loads(payload)

        zip_path = await send_confirmation_email(payload_dict, files)

        if zip_path and background_tasks:
            background_tasks.add_task(cleanup_files, zip_path)

        return {
            "success": bool(zip_path),
            "message": "Gửi thành công" if zip_path else "Lỗi gửi mail"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}