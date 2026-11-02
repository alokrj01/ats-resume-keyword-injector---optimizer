# ATS Resume Keyword Injector & Optimizer

An AI-powered resume optimization application that analyzes resumes against job descriptions, evaluates job relevance, identifies missing skills and keywords, and generates actionable suggestions to improve resume alignment.

## Features

- **Resume Upload:** Upload resumes for analysis.
- **Job Description Analysis:** Compare resume content against a target job description.
- **ATS Score Estimation:** Estimate resume relevance to the provided job description.
- **Missing Skills Detection:** Identify relevant skills and keywords that are missing.
- **Keyword Optimization:** Generate suggestions for improving resume keyword alignment.
- **AI-Powered Analysis:** Use Google Gemini to process resume and job description content.
- **Keyword Swap Preview:** Review suggested keyword replacements before applying them.
- **Document Processing:** Extract content from DOCX files and support PDF conversion.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Backend | Python, FastAPI |
| AI Integration | Google Gemini API |
| Data Validation | Pydantic |
| Document Processing | python-docx |
| PDF Conversion | LibreOffice |
| Dependency Management | uv, npm |
| Code Quality | ESLint |

## Project Structure

```text
ats-resume-optimizer/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── logging_config.py
│   │   ├── schemas/
│   │   │   └── resume_schema.py
│   │   ├── services/
│   │   │   ├── docx_service.py
│   │   │   └── llm_service.py
│   │   ├── __init__.py
│   │   └── main.py
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── list_gemini_models.py
│   ├── pyproject.toml
│   ├── .python-version
│   ├── README.md
│   ├── test_gemini.py
│   └── uv.lock
│
├── frontend/
│   ├── public/
│   │   └── doc.png
│   ├── src/
│   │   ├── api/
│   │   │   └── resumeApi.jsx
│   │   ├── components/
│   │   │   ├── SwapPreviewList.jsx
│   │   │   └── UploadForm.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

Install the following tools:

- Python 3.12+
- Node.js and npm
- uv
- Google Gemini API key
- LibreOffice (for local DOCX-to-PDF conversion)

### 1. Clone the Repository

```bash
git clone https://github.com/alokrj01/ats-resume-optimizer.git

cd ats-resume-optimizer
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
uv sync
```

### 3. Configure Environment Variables

Create your local environment file:

```bash
cp .env.example .env
```

Configure your Gemini API credentials in `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash
```

Replace the placeholder with your actual API key.

**Important:** Never commit your `.env` file or expose your API key publicly.

### 4. Run the Backend

From the `backend` directory:

```bash
uv run uvicorn app.main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

FastAPI interactive documentation:

```text
http://127.0.0.1:8000/docs
```

### 5. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development URL displayed in your terminal.

## Gemini API Configuration

The application uses Google's Gemini API for AI-powered resume analysis.

The model configuration is managed through environment variables, allowing the primary and fallback models to be changed without modifying application code.

| Environment Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Primary Gemini model |
| `GEMINI_FALLBACK_MODEL` | Fallback Gemini model |

## Document Processing

The backend includes a document processing service for handling DOCX files.

LibreOffice can be installed on Ubuntu or Linux Mint using:

```bash
sudo apt update
sudo apt install libreoffice
```

Verify the installation:

```bash
soffice --version
```

## Development

### Backend

Run the backend with automatic reload:

```bash
cd backend
uv run uvicorn app.main:app --reload
```

### Frontend

Run the frontend development server:

```bash
cd frontend
npm run dev
```

## Security

- Keep API keys and credentials in environment variables.
- Never commit `.env` files.
- Validate uploaded documents before processing.
- Avoid logging sensitive resume or personal information.
- Handle AI API errors and failed document conversions safely.

## Future Improvements

- Resume optimization and editing.
- Download optimized resumes in DOCX and PDF formats.
- More detailed ATS keyword analysis.
- Resume version management.
- Support for additional document formats.
- User authentication and saved analysis history.

## License

No open-source license has been specified yet. A license file should be added before distributing this project under an open-source license.

---

**Developed with ❤️ by Alok Ranjan**