from typing import List, Optional
from pydantic import BaseModel, Field


class KeywordSwapItem(BaseModel):
    original: str = Field(
        ..., description="Exact substring found in the original resume"
    )
    replacement: str = Field(
        ..., description="ATS-optimized replacement string of similar length"
    )
    category: str = Field(
        default="Skill", description="e.g., Hard Skill, Tool, Action Verb"
    )
    context: Optional[str] = Field(
        default=None,
        description="Full resume line or bullet where the original phrase appears",
    )
    section: Optional[str] = Field(
        default=None,
        description="Detected resume section (e.g., EXPERIENCE, PROJECTS, SUMMARY)",
    )
    allow_bold: bool = Field(
        default=True,
        description="Whether **bold** markers will render as bold in this line",
    )



class AnalyzeResumeResponse(BaseModel):
    session_id: str
    model_used: Optional[str] = Field(
        default=None,
        description="Cloud provider and model that generated the analysis",
    )
    job_title: Optional[str] = Field(
        default="Target_Role", description="Extracted job title from JD"
    )
    company_name: Optional[str] = Field(
        default="Company", description="Extracted company name from JD"
    )
    ats_score_before: int = Field(..., ge=0, le=100)
    ats_score_estimated: int = Field(..., ge=0, le=100)
    missing_skills: List[str]
    swaps: List[KeywordSwapItem]