# ATS Resume Optimizer frontend

A responsive React / Vite application for comparing a real DOCX resume with a real job description. The browser sends the selected file and job description to the configured backend, renders its ATS analysis, lets the user review edits, and exports a tailored DOCX or PDF. No fictional resume, mock analysis, or demo score is bundled in the production frontend.

## Live data flow

1. `POST /api/v1/resume/analyze` uploads the DOCX and job description to the backend. It returns the detected role, matched and missing skills, validated phrase edits, and baseline/projected ATS scores.
2. `POST /api/v1/resume/score` re-scores the active edits with the backend's deterministic `ATSScorer`. It does not call a cloud model and is debounced in the browser while a phrase is being edited.
3. `POST /api/v1/resume/generate-docx` and `POST /api/v1/resume/generate-pdf` receive the original DOCX plus the currently active edit map, then return the exported file.

The selected file is held only in page memory so exports work during the current session. Refreshing or leaving the page clears it from the browser.

## Develop

Use Node **22.12+** and npm. In `frontend/` run:

```bash
npm ci
npm run dev
```

In `backend/`, run:

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Local frontend requests use Vite's same-origin `/api` proxy. Set `API_PROXY_TARGET` to change the development backend upstream. For a separately deployed API, set `VITE_API_URL` to its public HTTPS origin and include the frontend origin in the backend's `CORS_ORIGINS`.

Configure a real `GROQ_API_KEY`, `OPENROUTER_API_KEY`, or `GEMINI_API_KEY` in `backend/.env` for analysis. PDF export requires LibreOffice on the backend server.

## Verify and deploy

```bash
npm run lint
npm run build
```

For a same-origin production preview of the built frontend and API, run this from `backend/`:

```bash
uv run uvicorn serve_site:app --host 0.0.0.0 --port 5173
```

For static hosting, rewrite `/privacy` and `/terms` to `index.html`; unknown page routes should serve `index.html` with a 404 response. Outfit Variable is bundled locally through Fontsource. The local icon sprite and license notices are in `public/art/` and `public/licenses/`.
