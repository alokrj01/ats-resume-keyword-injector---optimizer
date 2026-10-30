from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    PROJECT_NAME: str = "ATS Resume Optimizer API"
    API_V1_STR: str = "/api/v1"

    # Gemini is the sole supported AI provider. Configure both values in backend/.env.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = ""
    GEMINI_FALLBACK_MODEL: str = ""

    TEMP_DIR: Path = Path("/tmp/ats_resume_workspace")

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)