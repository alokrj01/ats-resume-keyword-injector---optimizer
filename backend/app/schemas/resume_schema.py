from typing import Annotated, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# The scorer compiles and searches one regex for every alias, and incorporates every
# excluded follower into that regex. Bound both nested collections and their terms
# during request validation so a /score request has a fixed matching budget. The
# limits retain the current catalog maximums of five aliases and 15 followers.
MAX_JD_SKILLS = 20
MAX_ALIASES_PER_JD_SKILL = 8
MAX_EXCLUDE_FOLLOWERS_PER_JD_SKILL = 16
MAX_JD_RULE_TERM_CHARS = 120

JDSkillRuleTerm = Annotated[str, Field(max_length=MAX_JD_RULE_TERM_CHARS)]


class JDSkillSpec(BaseModel):
    skill: JDSkillRuleTerm = Field(..., description="Canonical JD skill label")
    aliases: List[JDSkillRuleTerm] = Field(
        default_factory=list,
        max_length=MAX_ALIASES_PER_JD_SKILL,
    )
    case_sensitive: bool = Field(default=False)
    exclude_followers: List[JDSkillRuleTerm] = Field(
        default_factory=list,
        max_length=MAX_EXCLUDE_FOLLOWERS_PER_JD_SKILL,
    )


class KeywordSwapItem(BaseModel):
    original: str = Field(
        ...,
        description="Exact substring found in the original resume",
    )
    replacement: str = Field(
        ...,
        description="ATS-optimized replacement string of similar length",
    )
    category: str = Field(
        default="Skill",
        description="e.g., Hard Skill, Tool, Action Verb",
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
        default="Target_Role",
        description="Extracted job title from JD",
    )
    company_name: Optional[str] = Field(
        default="Company",
        description="Extracted company name from JD",
    )
    ats_score_before: int = Field(..., ge=0, le=100)
    ats_score_estimated: int = Field(..., ge=0, le=100)
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str]
    base_resume_text: str = Field(default="")
    jd_skills: List[JDSkillSpec] = Field(default_factory=list)
    swaps: List[KeywordSwapItem]


class ATSScoreRequest(BaseModel):
    """Input for a deterministic re-score after a user changes selected edits."""

    base_resume_text: str = Field(
        ...,
        min_length=1,
        max_length=45_000,
        description="Text extracted from the resume",
    )
    jd_skills: List[JDSkillSpec] = Field(
        default_factory=list,
        max_length=MAX_JD_SKILLS,
    )
    replacements: Dict[str, str] = Field(default_factory=dict, max_length=50)
    fallback_score_before: int = Field(default=0, ge=0, le=100)
    fallback_score_estimated: int = Field(default=0, ge=0, le=100)


class ATSScoreResponse(BaseModel):
    """A score calculated by the API's deterministic ATS scorer."""

    ats_score_before: int = Field(..., ge=0, le=100)
    ats_score_current: int = Field(..., ge=0, le=100)
    matched_skills: List[str] = Field(default_factory=list)
    gained_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    scoring_mode: Literal["keyword_coverage", "model_estimate"]