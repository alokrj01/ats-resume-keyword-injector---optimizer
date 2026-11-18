# ATS Resume Optimizer

> A full-stack, human-in-the-loop tool for tailoring a real DOCX resume to a real job description—without turning keyword matching into a black box.

ATS Resume Optimizer analyzes a candidate’s resume against a target role, identifies skill alignment and genuine gaps, proposes reviewable phrase edits, calculates a transparent ATS alignment score, and exports a tailored DOCX or PDF. It is designed to help candidates express relevant experience clearly while giving recruiters and hiring teams a more auditable view of role-specific alignment.

## Why it is useful

### For candidates

- Compare a resume with a specific job description before applying.
- See matched skills, missing skills, and a score that updates as suggested edits are selected.
- Review, edit, or reject every phrase suggestion before exporting.
- Keep the original DOCX unchanged; exports are created as new files.

### For recruiters and hiring teams

- See a transparent, role-specific alignment signal instead of a hidden “pass/fail” score.
- Review the skills behind the score and the exact resume context for each proposed edit.
- Encourage accurate terminology without inventing skills or experience.
- Use the output as a review aid—not as an automated hiring decision.

> **Important:** The ATS score measures alignment with the supplied job description. It does not predict interview outcomes, rank applicants, or replace professional recruiter judgment.

---

## Key features

- **Real DOCX workflow** — Upload a `.docx` resume and paste a real job description. No fictional resume or mock report is bundled in the application.
- **Multi-provider AI analysis** — Run analysis through Groq, OpenRouter, or Google Gemini; `auto` mode tries configured providers in order.
- **Deterministic ATS scoring** — When job skills can be identified, the score is based on keyword coverage. The backend re-scores selected edits using the same scorer used during analysis.
- **Live scorecard** — See the starting score, current selection, skills covered, matched skills, new gains, and remaining gaps.
- **Human approval for every edit** — Toggle each suggestion, change its wording, and review it in the original resume sentence before exporting.
- **Grounded suggestions** — The backend validates suggested source text against the uploaded resume and preserves the candidate’s control over what is included.
- **DOCX and PDF export** — Generate a tailored Word document or PDF from the active edits.
- **Responsive, accessible interface** — Optimized for mobile, tablet, and desktop layouts with keyboard focus states, semantic controls, and reduced-motion support.
- **Privacy-aware session handling** — The browser keeps an uploaded file only in memory for the current page session; the backend uses temporary files for analysis and export.

---

## How the application works

1. **Upload and analyze**
   - The frontend sends a DOCX resume, job description, and selected provider to `POST /api/v1/resume/analyze`.
   - The backend extracts text, calls a configured AI provider, validates suggestions, identifies job skills, and returns analysis data.

2. **Review the ATS score**
   - The frontend shows the returned baseline score, projected score, matched skills, missing skills, and phrase suggestions.
   - When a user changes an active edit, the frontend calls `POST /api/v1/resume/score` after a short debounce.
   - This refresh uses the backend’s deterministic `ATSScorer`; it does **not** make another cloud-AI request.

3. **Export the approved version**
   - The frontend sends only approved replacements with the original DOCX to the export endpoint.
   - The backend creates a new DOCX or PDF. The uploaded original is not overwritten.

---

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React 19, Vite 8, JavaScript, Tailwind CSS tooling |
| UI | Local Outfit Variable font, local Phosphor icon sprite, responsive custom CSS |
| Backend | Python 3.12+, FastAPI, Uvicorn |
| AI providers | Groq, OpenRouter, Google Gemini |
| Scoring | Deterministic Python `ATSScorer` with validated job-skill specifications |
| Validation | Pydantic |
| Word document processing | `python-docx` |
| PDF export | LibreOffice / `soffice` |
| Package management | `uv` for Python, npm for frontend |
| Frontend quality checks | ESLint and Vite production build |

---

## Project structure

```text
ats-resume-keyword-injector---optimizer/
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/
│   │   │   └── resume.py          # Analyze, score, DOCX, and PDF endpoints
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── logging_config.py
│   │   ├── schemas/
│   │   │   └── resume_schema.py
│   │   ├── services/
│   │   │   ├── ats_scorer.py      # Deterministic skill coverage scoring
│   │   │   ├── docx_service.py    # DOCX parsing, edits, and PDF conversion
│   │   │   └── llm_service.py     # Provider orchestration and validation
│   │   └── main.py
│   ├── .env.example
│   ├── pyproject.toml
│   └── uv.lock
├── frontend/
│   ├── public/
│   │   ├── art/icons.svg
│   │   ├── licenses/
│   │   └── doc.png
│   ├── src/
│   │   ├── api/resumeApi.jsx
│   │   ├── components/
│   │   │   ├── AtsScorecard.jsx
│   │   │   ├── ResumeWorkspace.jsx
│   │   │   ├── SwapPreviewList.jsx
│   │   │   ├── UploadForm.jsx
│   │   │   └── ...
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── LICENSE
└── README.md
```

---

## Getting started

### Prerequisites

Install the following before running the project locally:

- **Python 3.12+**
- **Node.js 22.12+** and npm
- **uv** — [installation instructions](https://docs.astral.sh/uv/)
- At least one AI provider key: Groq, OpenRouter, or Google Gemini
- **LibreOffice** for PDF export

### 1. Clone the repository

```bash
git clone https://github.com/alokrj01/ats-resume-keyword-injector---optimizer.git
cd ats-resume-keyword-injector---optimizer
```

### 2. Configure an AI provider

Create `backend/.env` and set at least one key before starting the backend. `auto` mode attempts available providers in this order: Groq, OpenRouter, then Gemini.

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
AI_PROVIDER=auto

# Fill in only the keys for providers you want to enable.
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GEMINI_API_KEY=your_gemini_api_key
```

You can also choose a specific provider from the frontend’s **Analysis settings** panel.

> Never commit `.env` files or expose provider keys in frontend code, screenshots, issues, or pull requests.
>
> Provider keys are loaded when the backend process starts. Restart the backend with Uvicorn after changing them.

### 3. Start the backend

From the `backend` directory:

```bash
uv sync
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend is available at:

- API: `http://127.0.0.1:8000`
- Interactive API docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/health`

### 4. Start the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open the Vite URL shown in the terminal—normally `http://localhost:5173`.

During local development, Vite proxies `/api` requests to `http://127.0.0.1:8000` by default.

---

## Environment configuration

### Backend: `backend/.env`

| Variable | Required | Purpose |
|---|---:|---|
| `AI_PROVIDER` | No | `auto`, `groq`, `openrouter`, or `gemini`. Defaults to `auto`. |
| `GROQ_API_KEY` | One provider key required | Enables Groq analysis. |
| `GROQ_MODEL` | No | Comma-separated Groq model fallback list. |
| `OPENROUTER_API_KEY` | One provider key required | Enables OpenRouter analysis. |
| `OPENROUTER_MODEL` | No | Comma-separated OpenRouter model fallback list. |
| `GEMINI_API_KEY` | One provider key required | Enables Google Gemini analysis. |
| `GEMINI_MODEL` | No | Primary Gemini model ID. |
| `GEMINI_FALLBACK_MODEL` | No | Comma-separated Gemini fallback model IDs. |
| `CORS_ORIGINS` | No | Comma-separated or JSON-array list of allowed frontend origins. |
| `TEMP_DIR` | No | Directory for temporary source and export files. |

### Frontend: `frontend/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Optional public API origin. Leave empty when the frontend and API use the same origin or Vite’s local proxy. |

For separately deployed frontend and backend services, set `VITE_API_URL` to the public HTTPS API origin and add the frontend origin to backend `CORS_ORIGINS`.

---

## API overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check. |
| `POST` | `/api/v1/resume/analyze` | Upload a DOCX and analyze it against a job description. |
| `POST` | `/api/v1/resume/score` | Deterministically re-score the current set of approved edits. |
| `POST` | `/api/v1/resume/generate-docx` | Generate a tailored DOCX. |
| `POST` | `/api/v1/resume/generate-pdf` | Generate a tailored PDF. |

### `POST /api/v1/resume/analyze`

Send `multipart/form-data` with:

- `resume_file` — a non-empty `.docx` file, maximum 10 MB
- `jd_text` — the target job description, maximum 30,000 characters
- `provider` — optional: `auto`, `groq`, `openrouter`, or `gemini`

The response includes the extracted role, validated phrase suggestions, ATS scores, matched skills, missing skills, and job-skill specifications used by the scorecard.

### `POST /api/v1/resume/score`

This JSON endpoint is used by the frontend after a user changes an edit. It accepts extracted resume text, job-skill specifications returned by `/analyze`, selected replacement text, and fallback scores. It does not upload a document and does not call an AI provider.

---

## Document handling and privacy

- Uploads must be DOCX files with selectable text; PDF is an export format only.
- The frontend does not persist an uploaded resume to browser storage. It retains the selected file only while the page remains open so export requests can include it.
- The backend creates temporary files for analysis and export. Output files are scheduled for deletion after the response; stale session files are cleaned by the API.
- Resume text and the job description are sent to the selected cloud provider during live analysis. Review the provider’s own privacy terms before uploading sensitive information.
- The score-refresh endpoint is deterministic and does not contact a cloud provider.

---

## Install LibreOffice for PDF export

On Ubuntu or Debian-based systems:

```bash
sudo apt update
sudo apt install libreoffice-writer
soffice --version
```

The DOCX export path does not require LibreOffice. PDF export does.

---

## Development and quality checks

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Backend

```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

For a same-origin production-style preview after building the frontend:

```bash
cd frontend
npm run build

cd ../backend
uv run uvicorn serve_site:app --host 0.0.0.0 --port 5173
```

---

## Responsible use

This project is intended to improve clarity and role alignment, not to fabricate qualifications or automate employment decisions.

- Only include experience the candidate can truthfully support.
- Review every suggested replacement before applying it.
- Do not use the score as the sole basis for screening, ranking, or rejecting candidates.
- Test every exported resume for factual accuracy, readability, and formatting before submitting it.

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2026 Alok Ranjan.

---

Developed with care by **Alok Ranjan**.
