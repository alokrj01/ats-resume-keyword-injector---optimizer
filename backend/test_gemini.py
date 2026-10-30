
import importlib.metadata
from pydantic import BaseModel
from typing import List
from google import genai
from google.genai import types
from app.core.config import settings

# Define the exact schema the LLM will populate
class SwapTestItem(BaseModel):
    original: str
    replacement: str
    category: str

class LLMTestResponse(BaseModel):
    ats_score_before: int
    ats_score_estimated: int
    missing_skills: List[str]
    swaps: List[SwapTestItem]

def run_verification():
    # 1. Check installed package versions
    genai_ver = importlib.metadata.version("google-genai")
    pillow_ver = importlib.metadata.version("pillow")
    print(f"Installed google-genai version : {genai_ver}")
    print(f"Installed Pillow version       : {pillow_ver}")
    print(f"Using Gemini Model             : {settings.GEMINI_MODEL}")

    # 2. Verify API Key is loaded from .env
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("AIzaSyYour"):
        print("\n[ERROR] Valid GEMINI_API_KEY not found in backend/.env!")
        return

    print("\nConnecting to Gemini API with Structured Outputs...")

    # 3. Test Structured JSON generation
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    sample_prompt = """
    Resume Bullet: Built backend APIs using FastAPI and Postgres.
    Job Description: Looking for a Python Engineer experienced in FastAPI microservices and PostgreSQL databases.
    """

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=sample_prompt,
        config=types.GenerateContentConfig(
            system_instruction="Swap exact resume substrings with JD keywords of similar length.",
            response_mime_type="application/json",
            response_schema=LLMTestResponse,
            temperature=0.1,
        ),
    )

    print("\n--- API SUCCESS! Raw Structured JSON Response ---")
    print(response.text)

if __name__ == "__main__":
    run_verification()