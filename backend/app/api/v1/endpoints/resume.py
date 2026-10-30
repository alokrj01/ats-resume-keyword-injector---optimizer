import json
import time
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from docx import Document
from app.core.config import settings
from app.schemas.resume_schema import AnalyzeResumeResponse
from app.services.docx_service import DocxService
from app.services.llm_service import LLMService

router = APIRouter()

@router.post("/analyze", response_model=AnalyzeResumeResponse)
async def analyze_resume(
    jd_text: str = Form(...),
    resume_file: UploadFile = File(...)
):
    if not resume_file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")

    t0 = time.perf_counter()
    session_id = str(uuid.uuid4())
    saved_docx_path = settings.TEMP_DIR / f"{session_id}.docx"

    content = await resume_file.read()
    saved_docx_path.write_bytes(content)

    doc = Document(str(saved_docx_path))
    extracted_text = DocxService.normalize_and_extract_text(doc)
    doc.save(str(saved_docx_path))
    t_docx = time.perf_counter()

    result = await LLMService.analyze_and_map_keywords(
        resume_text=extracted_text,
        jd_text=jd_text,
        session_id=session_id,
    )
    t_llm = time.perf_counter()

    print(f"[TIMING] DOCX Parse: {t_docx - t0:.2f}s | Gemini ({settings.GEMINI_MODEL}): {t_llm - t_docx:.2f}s")
    return result


@router.post("/generate-pdf")
async def generate_pdf(
    session_id: str = Form(...),
    replacements_json: str = Form(...)
):
    t0 = time.perf_counter()
    source_docx = settings.TEMP_DIR / f"{session_id}.docx"
    if not source_docx.exists():
        raise HTTPException(status_code=404, detail="Session expired or file not found.")

    replacements: dict = json.loads(replacements_json)
    output_docx = settings.TEMP_DIR / f"{session_id}_optimized.docx"

    doc = Document(str(source_docx))
    DocxService.apply_replacements(doc, replacements)
    doc.save(str(output_docx))
    t_swap = time.perf_counter()

    pdf_path = await DocxService.convert_to_pdf_async(output_docx)
    t_pdf = time.perf_counter()

    print(f"[TIMING] Keyword Swap: {t_swap - t0:.2f}s | LibreOffice PDF: {t_pdf - t_swap:.2f}s")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename="ATS_Tailored_Resume.pdf"
    )