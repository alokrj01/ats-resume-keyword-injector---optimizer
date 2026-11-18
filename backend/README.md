# ATS Resume Optimizer API

FastAPI service for live resume analysis, deterministic ATS scoring, and document export.

## Run locally

Use Python 3.12+ and [uv](https://docs.astral.sh/uv/):

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Create `backend/.env` from `.env.example` and configure at least one supported analysis provider (`GROQ_API_KEY`, `OPENROUTER_API_KEY`, or `GEMINI_API_KEY`). The `POST /api/v1/resume/score` endpoint does not use an AI provider; it is deterministic.

## API flow

- `POST /health` — service health check.
- `POST /api/v1/resume/analyze` — accepts `multipart/form-data` with `resume_file`, `jd_text`, and an optional `provider`. Returns the extracted role, validated phrase edits, score inputs, and initial ATS result.
- `POST /api/v1/resume/score` — accepts JSON with the `base_resume_text`, `jd_skills`, selected `replacements`, and fallback scores from `/analyze`. It recalculates keyword coverage through the same `ATSScorer` used by analysis, without a cloud-model request or document upload.
- `POST /api/v1/resume/generate-docx` — applies selected edits to the supplied DOCX and returns a tailored Word document.
- `POST /api/v1/resume/generate-pdf` — applies selected edits and returns a tailored PDF. LibreOffice is required on the server.

The frontend uses the stateless upload form on export, so a document can still be exported if a temporary analysis session has expired. Temporary server-side files are cleaned up by the API.
