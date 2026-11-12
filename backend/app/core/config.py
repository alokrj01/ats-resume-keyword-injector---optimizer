import json
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "ATS Resume Optimizer API"
    API_V1_STR: str = "/api/v1"

    # Cloud-only AI providers: "auto" | "groq" | "openrouter" | "gemini"
    AI_PROVIDER: str = "auto"

    # 1. GroqCloud Free API (Cloud-hosted Qwen 3.8 27B)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b,openai/gpt-oss-120b"

    # 2. OpenRouter Cloud Free API (:free Qwen models)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = (
        "qwen/qwen3-next-80b-a3b-instruct:free,"
        "qwen/qwen3.6-35b-a3b:free,"
        "openrouter/free"
    )

    # 3. Google Gemini Cloud Free API
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.1-flash-lite,gemini-3.8-flash"

    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://frontend-ats-resume-keyword-injector.onrender.com"
    )

    TEMP_DIR: Path = Path("/tmp/ats_resume_workspace")

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        raw = (self.CORS_ORIGINS or "").strip()
        if not raw:
            return []
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [
                        str(o).strip().rstrip("/")
                        for o in parsed
                        if str(o).strip()
                    ]
            except json.JSONDecodeError:
                pass
        return [
            origin.strip().rstrip("/")
            for origin in raw.split(",")
            if origin.strip()
        ]


settings = Settings()
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)