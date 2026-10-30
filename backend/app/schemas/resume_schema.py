from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class KeywordSwapItem(BaseModel):
    original: str = Field(..., description="Exact substring found in the original resume")
    replacement: str = Field(..., description="ATS-optimized replacement string of similar length")
    category: str = Field(default="Skill", description="e.g., Hard Skill, Tool, Action Verb")

class AnalyzeResumeResponse(BaseModel):
    session_id: str
    job_title: Optional[str] = Field(default="Target_Role", description="Extracted job title from JD")
    company_name: Optional[str] = Field(default="Company", description="Extracted company name from JD")
    ats_score_before: int
    ats_score_estimated: int
    missing_skills: List[str]
    swaps: List[KeywordSwapItem]