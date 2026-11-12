import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.core.config import settings
from app.schemas.resume_schema import AnalyzeResumeResponse
from app.services.docx_service import DocxService, MAX_DOCX_COMPRESSED_BYTES
from app.services.llm_service import LLMService

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_CHUNK_BYTES = 64 * 1024           # 64 KB upload stream chunks
SESSION_TTL_SECONDS = 3600               # Expire base session .docx files after 1 hour
MAX_JD_CHARS = 30_000                    # Upper bound for pasted job descriptions
MAX_REPLACEMENTS_JSON_BYTES = 64 * 1024  # 64 KB max replacements JSON payload
MAX_REPLACEMENT_ITEMS = 50
MAX_PHRASE_CHARS = 1_000


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to remove temporary file: %s", path.name)


def _cleanup_expired_files(
    temp_dir: Path, max_age_seconds: int = SESSION_TTL_SECONDS
) -> None:
    if not temp_dir.is_dir():
        return
    cutoff = time.time() - max_age_seconds
    for item in temp_dir.iterdir():
        try:
            if item.is_file() and item.suffix in {".docx", ".pdf"}:
                if item.stat().st_mtime < cutoff:
                    item.unlink(missing_ok=True)
        except OSError:
            continue


def _resolve_session_docx(session_id: str) -> tuple[str, Path]:
    """Ensure session_id is a valid UUID and cannot traverse outside TEMP_DIR."""
    try:
        parsed = uuid.UUID((session_id or "").strip())
    except (ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=400, detail="Invalid session_id format."
        ) from exc

    canonical_id = str(parsed)
    temp_root = settings.TEMP_DIR.resolve()
    source_docx = (temp_root / f"{canonical_id}.docx").resolve()

    if not source_docx.is_relative_to(temp_root):
        raise HTTPException(status_code=400, detail="Invalid session_id path.")

    return canonical_id, source_docx


def _parse_replacements(replacements_json: str) -> Dict[str, str]:
    if len(replacements_json.encode("utf-8")) > MAX_REPLACEMENTS_JSON_BYTES:
        raise HTTPException(
            status_code=413, detail="Replacements payload is too large."
        )

    try:
        raw = json.loads(replacements_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid JSON in replacements_json."
        ) from exc

    if not isinstance(raw, dict):
        raise HTTPException(
            status_code=400,
            detail="replacements_json must be a JSON object mapping original -> replacement strings.",
        )

    if len(raw) > MAX_REPLACEMENT_ITEMS:
        raise HTTPException(
            status_code=400,
            detail=f"Too many keyword swaps (maximum {MAX_REPLACEMENT_ITEMS}).",
        )

    cleaned: Dict[str, str] = {}
    for orig, repl in raw.items():
        if not isinstance(orig, str) or not isinstance(repl, str):
            raise HTTPException(
                status_code=400,
                detail="All replacement keys and values must be strings.",
            )
        orig_stripped = orig.strip()
        repl_stripped = repl.strip()
        if not orig_stripped or not repl_stripped:
            continue
        if (
            len(orig_stripped) > MAX_PHRASE_CHARS
            or len(repl_stripped) > MAX_PHRASE_CHARS
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Replacement phrases cannot exceed {MAX_PHRASE_CHARS} characters.",
            )
        cleaned[orig_stripped] = repl_stripped

    return cleaned


async def _save_upload_bounded(upload: UploadFile, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    bytes_written = 0
    try:
        with destination.open("wb") as out_file:
            while True:
                chunk = await upload.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_DOCX_COMPRESSED_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail="Uploaded .docx file exceeds the 10 MB size limit.",
                    )
                out_file.write(chunk)
    except BaseException:
        _safe_unlink(destination)
        raise
    finally:
        await upload.close()

    if bytes_written == 0:
        _safe_unlink(destination)
        raise HTTPException(status_code=400, detail="Uploaded .docx file is empty.")


def _normalize_and_resave_docx(docx_path: Path) -> str:
    doc = DocxService.load_document(docx_path)
    extracted_text = DocxService.normalize_and_extract_text(doc)
    doc.save(str(docx_path))
    return extracted_text


def _build_optimized_docx(
    source_docx: Path, output_docx: Path, replacements: Dict[str, str]
) -> None:
    doc = DocxService.load_document(source_docx)
    DocxService.apply_replacements(doc, replacements)
    doc.save(str(output_docx))


@router.post("/analyze", response_model=AnalyzeResumeResponse)
async def analyze_resume(
    jd_text: str = Form(...),
    provider: str = Form("auto"),
    resume_file: UploadFile = File(...),
):
    filename = (resume_file.filename or "").strip()
    if not filename.lower().endswith(".docx"):
        await resume_file.close()
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")

    jd_cleaned = jd_text.strip()
    if not jd_cleaned:
        await resume_file.close()
        raise HTTPException(
            status_code=400, detail="Job description cannot be empty."
        )
    if len(jd_cleaned) > MAX_JD_CHARS:
        await resume_file.close()
        raise HTTPException(
            status_code=413,
            detail=f"Job description exceeds the {MAX_JD_CHARS:,}-character limit.",
        )

    t0 = time.perf_counter()
    await asyncio.to_thread(_cleanup_expired_files, settings.TEMP_DIR)

    session_id = str(uuid.uuid4())
    saved_docx_path = settings.TEMP_DIR.resolve() / f"{session_id}.docx"

    await _save_upload_bounded(resume_file, saved_docx_path)

    try:
        extracted_text = await asyncio.to_thread(
            _normalize_and_resave_docx, saved_docx_path
        )
        t_docx = time.perf_counter()

        result = await LLMService.analyze_and_map_keywords(
            resume_text=extracted_text,
            jd_text=jd_cleaned,
            session_id=session_id,
            provider=provider,
        )
        t_llm = time.perf_counter()
    except BaseException:
        _safe_unlink(saved_docx_path)
        raise

    logger.info(
        "[TIMING] DOCX Parse: %.2fs | LLM (%s): %.2fs",
        t_docx - t0,
        result.model_used or "unknown",
        t_llm - t_docx,
    )
    return result


@router.post("/generate-pdf")
async def generate_pdf(
    session_id: str = Form(...),
    replacements_json: str = Form(...),
):
    t0 = time.perf_counter()
    canonical_id, source_docx = _resolve_session_docx(session_id)

    if not source_docx.is_file():
        raise HTTPException(
            status_code=404, detail="Session expired or file not found."
        )

    # Refresh session TTL so active users editing swaps don't expire mid-session
    source_docx.touch(exist_ok=True)

    replacements = _parse_replacements(replacements_json)

    render_id = uuid.uuid4().hex
    output_docx = source_docx.parent / f"{canonical_id}_{render_id}.docx"
    pdf_path = output_docx.with_suffix(".pdf")

    try:
        await asyncio.to_thread(
            _build_optimized_docx, source_docx, output_docx, replacements
        )
        t_swap = time.perf_counter()

        pdf_path = await DocxService.convert_to_pdf_async(output_docx)
        t_pdf = time.perf_counter()
    except BaseException:
        _safe_unlink(pdf_path)
        raise
    finally:
        _safe_unlink(output_docx)

    logger.info(
        "[TIMING] Keyword Swap: %.2fs | LibreOffice PDF: %.2fs",
        t_swap - t0,
        t_pdf - t_swap,
    )

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename="ATS_Tailored_Resume.pdf",
        background=BackgroundTask(_safe_unlink, pdf_path),
    )