import asyncio
import json
import logging
from typing import List, Optional

from fastapi import HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.schemas.resume_schema import (
    AnalyzeResumeResponse,
    KeywordSwapItem,
)


logger = logging.getLogger(__name__)


SYSTEM_INSTRUCTION = """
You are an expert ATS Resume Optimizer.
Compare the candidate's Resume Text with the Target Job Description (JD).

1. Extract the primary Job Title and Company Name from the JD.
   If the company name is missing, use "General".
2. Identify exact phrases in the Resume that can be swapped with
   high-value ATS keywords from the JD.

CRITICAL RULES:
1. "original" MUST be an exact, case-sensitive substring of 3 to 8
   words from the provided Resume Text. NEVER use a single standalone word.
2. "replacement" MUST be within +/- 12% of the visible character length
   of "original", excluding markdown asterisks.
3. Do not use bold inside SKILLS, Tech Stack, or CERTIFICATIONS sections.
4. Only use **bold** inside EXPERIENCE or PROJECTS bullet points,
   highlighting at most one key technical term per bullet.
5. Return at most 8-10 high-impact swaps.
6. Never invent experience, skills, qualifications, or achievements.
"""


class LLMOutputSchema(BaseModel):
    job_title: Optional[str] = Field(default="Software Engineer")
    company_name: Optional[str] = Field(default="General")
    ats_score_before: int
    ats_score_estimated: int
    missing_skills: List[str]
    swaps: List[KeywordSwapItem]


class LLMService:
    # ---------------------------------------------------------
    # Generate content using primary and fallback Gemini models
    # ---------------------------------------------------------

    @classmethod
    async def _generate_with_fallback(cls, prompt: str) -> tuple[str, str]:
        if not settings.GEMINI_API_KEY.strip():
            logger.error("GEMINI_API_KEY is not configured.")
            raise HTTPException(
                status_code=500,
                detail="GEMINI_API_KEY is not configured.",
            )

        primary_model = settings.GEMINI_MODEL.strip()
        fallback_model = settings.GEMINI_FALLBACK_MODEL.strip()

        if not primary_model:
            logger.error("GEMINI_MODEL is not configured.")
            raise HTTPException(
                status_code=500,
                detail="GEMINI_MODEL is not configured.",
            )

        # Avoid attempting the same model twice.
        models = [primary_model]
        if fallback_model and fallback_model != primary_model:
            models.append(fallback_model)

        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
        except Exception as exc:
            logger.exception("Gemini client initialization failed.")
            raise HTTPException(
                status_code=502,
                detail="Unable to initialize Gemini client.",
            ) from exc

        last_error = None

        for index, model in enumerate(models):
            try:
                logger.info("Attempting Gemini model: %s", model)

                response = await asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        response_mime_type="application/json",
                        response_schema=LLMOutputSchema,
                        temperature=0.1,
                    ),
                )

                if not response.text:
                    raise ValueError(
                        "Gemini model %s returned an empty response.", model
                    )

                logger.info(
                    "Gemini response generated successfully using model: %s",
                    model,
                )
                return response.text, model

            except Exception as exc:
                last_error = exc

                # Google SDK errors can expose HTTP status through either
                # 'code' or 'status_code'.
                status = (
                    getattr(exc, "code", None)
                    or getattr(exc, "status_code", None)
                )
                error_name = type(exc).__name__

                retryable_status_codes = {404, 408, 500, 502, 503, 504}
                retryable_error_names = {
                    "ServerError",
                    "ServiceUnavailable",
                    "GatewayTimeout",
                    "TimeoutError",
                    "TimeoutException",
                    "ConnectError",
                    "ReadTimeout",
                }

                retryable = (
                    status in retryable_status_codes
                    or error_name in retryable_error_names
                    or isinstance(exc, (TimeoutError, asyncio.TimeoutError))
                )

                logger.error(
                    "Gemini request failed | model=%s | status=%s | error=%s",
                    model,
                    status,
                    error_name,
                    exc_info=True,
                )

                # Do not switch models for authentication, permission,
                # quota, or invalid-request errors.
                if not retryable:
                    logger.warning(
                        "Gemini error is not eligible for automatic fallback. "
                        "model=%s status=%s error=%s",
                        model,
                        status,
                        error_name,
                    )
                    break

                if index == len(models) - 1:
                    break

                next_model = models[index + 1]
                logger.warning(
                    "Switching Gemini model | primary=%s | fallback=%s",
                    model,
                    next_model,
                )

        logger.error(
            "All configured Gemini model attempts failed. Last error type: %s",
            type(last_error).__name__ if last_error else "Unknown",
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini analysis failed. Please check your "
                "API configuration and backend logs."
            ),
        ) from last_error

    # ---------------------------------------------------------
    # Main ATS analysis function
    # ---------------------------------------------------------

    @classmethod
    async def analyze_and_map_keywords(
        cls,
        resume_text: str,
        jd_text: str,
        session_id: str,
    ) -> AnalyzeResumeResponse:
        # Validate input.
        if not resume_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Resume text is empty.",
            )

        if not jd_text.strip():
            raise HTTPException(
                status_code=400,
                detail="Job description is empty.",
            )

        prompt = (
            f"RESUME TEXT:\n{resume_text}\n\n"
            f"TARGET JOB DESCRIPTION:\n{jd_text}"
        )

        # Gemini generation with automatic fallback.
        try:
            response_text, used_model = await cls._generate_with_fallback(prompt)
            raw_data = json.loads(response_text)

            logger.info(
                "Resume analysis completed using Gemini model: %s",
                used_model,
            )

        except HTTPException:
            raise

        except json.JSONDecodeError as exc:
            logger.exception("Gemini returned invalid JSON.")
            raise HTTPException(
                status_code=502,
                detail="Gemini returned invalid JSON.",
            ) from exc

        except Exception as exc:
            logger.exception("Unexpected error during Gemini analysis.")
            raise HTTPException(
                status_code=502,
                detail="Gemini analysis failed.",
            ) from exc

        # Validate AI response structure.
        if not isinstance(raw_data, dict):
            logger.error("Gemini response was not a JSON object.")
            raise HTTPException(
                status_code=502,
                detail="AI returned an invalid JSON structure.",
            )

        required_fields = (
            "ats_score_before",
            "ats_score_estimated",
            "missing_skills",
            "swaps",
        )

        missing_fields = [
            field for field in required_fields if field not in raw_data
        ]

        if missing_fields:
            logger.error(
                "Gemini response is missing required fields: %s",
                missing_fields,
            )
            raise HTTPException(
                status_code=502,
                detail=(
                    "AI response is missing required fields: "
                    + ", ".join(missing_fields)
                ),
            )

        raw_data.setdefault("job_title", "Target_Role")
        raw_data.setdefault("company_name", "General")

        # Validate keyword replacements.
        swaps = raw_data.get("swaps")
        if not isinstance(swaps, list):
            logger.error("Gemini response contains an invalid swaps list.")
            raise HTTPException(
                status_code=502,
                detail="AI returned an invalid swaps list.",
            )

        logger.info("Gemini generated %d keyword swaps.", len(swaps))

        valid_swaps = []
        for swap in swaps:
            if not isinstance(swap, dict):
                continue

            original = swap.get("original")
            replacement = swap.get("replacement")

            if not isinstance(original, str) or not isinstance(replacement, str):
                continue

            original = original.strip()
            replacement = replacement.strip()

            if not original or not replacement:
                continue

            # Do not log the phrase itself: it may contain personal resume data.
            if original not in resume_text:
                logger.warning(
                    "Rejected keyword swap because its original phrase "
                    "was not found in the resume."
                )
                continue

            replacement_plain = replacement.replace("**", "").strip()
            if original == replacement_plain:
                continue

            valid_swaps.append(
                {
                    **swap,
                    "original": original,
                    "replacement": replacement,
                }
            )

        logger.info(
            "Keyword swap validation completed | valid=%d | generated=%d",
            len(valid_swaps),
            len(swaps),
        )

        raw_data["swaps"] = valid_swaps

        # Validate final API response using Pydantic.
        try:
            result = AnalyzeResumeResponse(
                session_id=session_id,
                **raw_data,
            )
            return result

        except ValidationError as exc:
            logger.error(
                "Gemini response failed Pydantic validation: %s",
                exc.errors(),
            )
            raise HTTPException(
                status_code=502,
                detail="AI response failed validation.",
            ) from exc
