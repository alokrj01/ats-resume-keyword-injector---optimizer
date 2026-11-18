import math
import re
from typing import Dict, List, Optional, Sequence, Set, Tuple

from app.schemas.resume_schema import JDSkillSpec, MAX_JD_SKILLS

# Canonical multi-domain ATS skill catalog:
# (canonical_name, aliases, case_sensitive, exclude_followers)
CANONICAL_SKILLS: Tuple[Tuple[str, Tuple[str, ...], bool, Tuple[str, ...]], ...] = (
    # Programming Languages
    ("Python", ("Python",), False, ()),
    ("JavaScript", ("JavaScript", "ES6"), False, ()),
    ("TypeScript", ("TypeScript",), False, ()),
    ("Java", ("Java",), False, ("Script",)),
    ("C++", ("C++",), False, ()),
    ("C#", ("C#",), False, ()),
    (
        "Go",
        ("Golang", "Go"),
        True,
        (
            "to",
            "beyond",
            "through",
            "into",
            "live",
            "ahead",
            "further",
            "above",
            "on",
            "with",
            "from",
            "back",
            "out",
            "for",
            "market",
        ),
    ),
    ("Rust", ("Rust",), True, ()),
    ("SQL", ("SQL",), False, ()),
    ("NoSQL", ("NoSQL",), False, ()),
    ("HTML5", ("HTML5", "HTML"), False, ()),
    ("CSS3", ("CSS3", "CSS"), False, ()),
    # Frontend & Mobile
    (
        "React.js",
        ("React.js", "ReactJS", "React"),
        False,
        ("Native", "Router"),
    ),
    ("React Native", ("React Native",), False, ()),
    ("Next.js", ("Next.js", "NextJS"), False, ()),
    ("Vue.js", ("Vue.js", "VueJS"), False, ()),
    ("Angular", ("Angular", "AngularJS"), False, ()),
    ("Tailwind CSS", ("Tailwind CSS", "TailwindCSS", "Tailwind"), False, ()),
    ("Redux", ("Redux",), False, ()),
    ("Flutter", ("Flutter",), False, ()),
    ("Accessibility", ("Accessibility", "WCAG", "a11y"), False, ()),
    # Backend, APIs & Architecture
    (
        "Full-Stack Development",
        ("Full-Stack", "Fullstack", "Full Stack"),
        False,
        (),
    ),
    ("Node.js", ("Node.js", "NodeJS"), False, ()),
    ("Express.js", ("Express.js", "ExpressJS"), False, ()),
    ("FastAPI", ("FastAPI",), False, ()),
    ("Django", ("Django",), False, ()),
    ("Flask", ("Flask",), False, ()),
    ("Spring Boot", ("Spring Boot",), False, ()),
    (".NET", (".NET", "ASP.NET", "VB.NET", "DotNet"), False, ()),
    ("GraphQL", ("GraphQL",), False, ()),
    (
        "REST APIs",
        ("REST APIs", "REST API", "RESTful APIs", "RESTful API"),
        False,
        (),
    ),
    ("Microservices", ("Microservices", "Microservice"), False, ()),
    ("Serverless", ("Serverless",), False, ()),
    (
        "System Architecture",
        (
            "System Architecture",
            "Software Architecture",
            "Architect Systems",
            "Architect",
            "Architected",
        ),
        False,
        (),
    ),
    (
        "Scalable Systems",
        ("Scalable", "Scalability"),
        False,
        (),
    ),
    (
        "End-to-End Delivery",
        (
            "End-to-End",
            "Shipping End-to-End",
            "Shipped",
        ),
        False,
        (),
    ),
    # Databases & Analytics
    ("PostgreSQL", ("PostgreSQL", "Postgres"), False, ()),
    ("MySQL", ("MySQL",), False, ()),
    ("MongoDB", ("MongoDB",), False, ()),
    ("Redis", ("Redis",), False, ()),
    ("Supabase", ("Supabase",), False, ()),
    ("Firebase", ("Firebase",), False, ()),
    (
        "Data Analysis",
        (
            "Data Analysis",
            "Data Analytics",
            "Analyze Data",
            "Analyzing Data",
        ),
        False,
        (),
    ),
    ("Power BI", ("Power BI",), False, ()),
    ("Tableau", ("Tableau",), False, ()),
    ("Data Structures", ("Data Structures",), False, ()),
    ("Algorithms", ("Algorithms",), False, ()),
    # Cloud, DevOps & Testing
    ("AWS", ("AWS", "Amazon Web Services"), False, ()),
    (
        "Google Cloud",
        ("Google Cloud", "GCP", "Google Cloud Platform"),
        False,
        (),
    ),
    ("Azure", ("Microsoft Azure", "Azure"), False, ()),
    (
        "Cloud Infrastructure",
        (
            "Cloud Infrastructure",
            "Cloud Deployment",
            "Cloud Platforms",
            "Cloud-Based",
        ),
        False,
        (),
    ),
    ("Docker", ("Docker", "Containerization"), False, ()),
    ("Kubernetes", ("Kubernetes", "K8s"), False, ()),
    (
        "CI/CD",
        ("CI/CD", "Continuous Integration", "Continuous Deployment"),
        False,
        (),
    ),
    ("Git", ("Git", "Version Control"), False, ()),
    ("Linux", ("Linux", "Unix"), False, ()),
    ("Unit Testing", ("Unit Testing", "Pytest", "Jest"), False, ()),
    # AI & Machine Learning
    ("Machine Learning", ("Machine Learning",), False, ()),
    ("Deep Learning", ("Deep Learning",), False, ()),
    ("NLP", ("NLP", "Natural Language Processing"), False, ()),
    ("PyTorch", ("PyTorch",), False, ()),
    ("TensorFlow", ("TensorFlow",), False, ()),
    ("Scikit-Learn", ("Scikit-Learn", "sklearn"), False, ()),
    ("Transformers", ("Transformers", "Hugging Face"), False, ()),
    (
        "Generative AI",
        ("Generative AI", "GenAI", "LLMs", "AI Agents"),
        False,
        (),
    ),
    # Engineering, Operations & Domain-Agnostic Skills
    (
        "Process Optimization",
        (
            "Process Optimization",
            "Optimize Chemical Processes",
            "Optimization of Production Processes",
            "Optimize Processes",
            "Workflow Optimization",
        ),
        False,
        (),
    ),
    (
        "Process Monitoring",
        (
            "Process Monitoring",
            "Monitor and Analyze Production Processes",
            "Production Processes",
        ),
        False,
        (),
    ),
    (
        "Troubleshooting",
        ("Troubleshooting", "Troubleshoot", "Troubleshot"),
        False,
        (),
    ),
    (
        "Simulation",
        (
            "Simulation Software",
            "Simulation Techniques",
            "Process Simulation",
            "Simulation Modeling",
        ),
        False,
        (),
    ),
    (
        "Quality Control",
        ("Quality Control", "Quality Assurance"),
        False,
        (),
    ),
    (
        "Project Management",
        ("Project Management", "Manage Projects"),
        False,
        (),
    ),
    (
        "Cross-Functional Collaboration",
        (
            "Cross-Functional Teams",
            "Cross-Functional",
            "Collaborate with Clients",
            "Collaborate Closely",
        ),
        False,
        (),
    ),
    (
        "Safety Compliance",
        (
            "Safety Regulations",
            "Safety Compliance",
            "Safety Procedures",
            "Environmental Compliance",
        ),
        False,
        (),
    ),
    (
        "Chemical Process Engineering",
        (
            "Chemical Process Engineering",
            "Chemical Processes",
            "Manufacturing Chemicals",
        ),
        False,
        (),
    ),
    (
        "Workflow Automation",
        ("Workflow Automation", "Process Automation", "Automation"),
        False,
        (),
    ),
    (
        "Operational Efficiency",
        ("Operational Efficiency", "Maximum Efficiency"),
        False,
        (),
    ),
)

STOPWORD_PHRASES: Set[str] = {
    "and",
    "the",
    "for",
    "with",
    "team",
    "work",
    "role",
    "company",
    "engineering",
    "software",
    "experience",
    "teamwork",
    "communication",
    "skills",
    "bachelor",
    "degree",
    "remote",
    "hybrid",
    "full time",
    "responsibilities",
    "qualifications",
    "requirements",
}


def _skill_equivalence_keys(value: str) -> Tuple[str, ...]:
    """
    Generate normalized equivalence keys for exact skill/alias deduplication
    without collapsing distinct compound skills (e.g. 'AWS' vs 'AWS Lambda')
    and without stripping significant skill punctuation ('.NET', 'C++', 'C#').
    """
    collapsed = re.sub(r"\s+", " ", (value or "")).strip().lower()
    if not collapsed:
        return ()
    hyphen_norm = re.sub(r"[\s\-]+", " ", collapsed).strip()
    if hyphen_norm and hyphen_norm != collapsed:
        return (collapsed, hyphen_norm)
    return (collapsed,)


CATALOG_EQUIVALENT_KEYS: Set[str] = {
    key
    for name, aliases, _, _ in CANONICAL_SKILLS
    for term in (name, *aliases)
    for key in _skill_equivalence_keys(term)
}


class ATSScorer:
    @staticmethod
    def _is_ascii_word_char(ch: str) -> bool:
        return (
            ("a" <= ch <= "z")
            or ("A" <= ch <= "Z")
            or ("0" <= ch <= "9")
            or ch == "_"
        )

    @classmethod
    def _clean_candidate_skill(cls, raw_item: str) -> str:
        """
        Strip list bullets, quotes, and trailing sentence punctuation while
        preserving significant skill punctuation like leading '.' (.NET) and
        trailing '+'/'#' (C++, C#).
        """
        cleaned = re.sub(r"\s+", " ", raw_item or "").strip()
        if not cleaned:
            return ""

        cleaned = cleaned.lstrip(" •*–—,:;\"'`“”‘’-")
        cleaned = cleaned.rstrip(" •*–—,.;:\"'`“”‘’-")

        while cleaned.startswith("(") and cleaned.endswith(")"):
            inner = cleaned[1:-1].strip()
            depth = 0
            balanced = True
            for ch in inner:
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                    if depth < 0:
                        balanced = False
                        break
            if balanced and depth == 0 and inner:
                cleaned = inner.lstrip(" •*–—,:;\"'`“”‘’-").rstrip(
                    " •*–—,.;:\"'`“”‘’-"
                )
            else:
                break

        return cleaned.strip()

    @classmethod
    def matches_spec(cls, text: str, spec: JDSkillSpec) -> bool:
        norm_text = re.sub(r"\s+", " ", text or "")
        if not norm_text:
            return False

        flags = 0 if spec.case_sensitive else re.IGNORECASE
        for alias in spec.aliases:
            cleaned = re.sub(r"\s+", " ", (alias or "")).strip()
            if not cleaned:
                continue
            escaped = re.escape(cleaned).replace(r"\ ", r"\s+")
            # Disallow ASCII word chars and '.' immediately preceding a skill
            # so '.NET' does not match 'ASP.NET'/'authorize.net' and 'NET' does
            # not match '.NET'.
            left = r"(?:^|[^A-Za-z0-9_.])"
            right = r"(?![A-Za-z0-9_+#])"
            excl = ""
            if spec.exclude_followers:
                joined = "|".join(
                    re.escape(w) for w in spec.exclude_followers if w
                )
                if joined:
                    excl = rf"(?!\s+(?:{joined})(?![A-Za-z0-9_]))"

            pattern = re.compile(f"{left}(?:{escaped}){right}{excl}", flags)
            if pattern.search(norm_text):
                return True
        return False

    @classmethod
    def _build_word_boundary_pattern(cls, phrase: str) -> re.Pattern:
        escaped = re.escape(phrase)
        prefix = (
            r"(?<![A-Za-z0-9_])"
            if (phrase and cls._is_ascii_word_char(phrase[0]))
            else ""
        )
        suffix = (
            r"(?![A-Za-z0-9_])"
            if (phrase and cls._is_ascii_word_char(phrase[-1]))
            else ""
        )
        return re.compile(f"{prefix}{escaped}{suffix}")

    @classmethod
    def apply_swaps_to_text(
        cls, base_text: str, replacements: Dict[str, str]
    ) -> str:
        if not base_text or not replacements:
            return base_text or ""

        sorted_pairs = sorted(
            (
                (k.strip(), v.replace("**", "").strip())
                for k, v in replacements.items()
                if isinstance(k, str)
                and isinstance(v, str)
                and k.strip()
                and v.replace("**", "").strip()
            ),
            key=lambda kv: len(kv[0]),
            reverse=True,
        )
        if not sorted_pairs:
            return base_text

        out_lines: List[str] = []
        for line in base_text.splitlines():
            if not line:
                out_lines.append(line)
                continue

            planned: List[Tuple[int, int, str]] = []
            for old_text, new_text in sorted_pairs:
                if old_text not in line:
                    continue
                pat = cls._build_word_boundary_pattern(old_text)
                for m in pat.finditer(line):
                    s, e = m.start(), m.end()
                    if any(not (e <= ps or s >= pe) for ps, pe, _ in planned):
                        continue
                    planned.append((s, e, new_text))

            if not planned:
                out_lines.append(line)
                continue

            planned.sort(key=lambda item: item[0], reverse=True)
            updated = line
            for s, e, new_text in planned:
                updated = updated[:s] + new_text + updated[e:]
            out_lines.append(updated)

        return "\n".join(out_lines)

    @classmethod
    def extract_jd_skill_specs(
        cls,
        jd_text: str,
        llm_jd_keywords: Optional[Sequence[str]] = None,
        llm_missing_skills: Optional[Sequence[str]] = None,
    ) -> List[JDSkillSpec]:
        if not jd_text or not jd_text.strip():
            return []

        specs: List[JDSkillSpec] = []
        seen_equiv_keys: Set[str] = set()

        # 1. Deterministically scan JD against curated multi-domain catalog
        for name, aliases, case_sensitive, exclude_followers in CANONICAL_SKILLS:
            candidate = JDSkillSpec(
                skill=name,
                aliases=list(aliases),
                case_sensitive=case_sensitive,
                exclude_followers=list(exclude_followers),
            )
            if cls.matches_spec(jd_text, candidate):
                specs.append(candidate)
                for term in (name, *aliases):
                    seen_equiv_keys.update(_skill_equivalence_keys(term))

        # 2. Merge domain-specific LLM-identified JD skills ONLY if grounded in jd_text
        extra_candidates: List[str] = []
        for source in (llm_jd_keywords or (), llm_missing_skills or ()):
            for raw_item in source:
                if isinstance(raw_item, str):
                    cleaned = cls._clean_candidate_skill(raw_item)
                    if cleaned:
                        extra_candidates.append(cleaned)

        for phrase in extra_candidates:
            if len(specs) >= MAX_JD_SKILLS:
                break

            equiv_keys = _skill_equivalence_keys(phrase)
            if not equiv_keys:
                continue

            low = equiv_keys[0]
            is_short_valid = len(phrase) == 2 and (
                any(ch in phrase for ch in "+#")
                or any(ch.isdigit() for ch in phrase)
            )
            if (
                (len(phrase) < 3 and not is_short_valid)
                or len(phrase) > 45
                or len(phrase.split()) > 5
                or low in STOPWORD_PHRASES
                or any(k in seen_equiv_keys for k in equiv_keys)
                or any(k in CATALOG_EQUIVALENT_KEYS for k in equiv_keys)
            ):
                continue

            probe = JDSkillSpec(
                skill=phrase,
                aliases=[phrase],
                case_sensitive=False,
                exclude_followers=[],
            )
            if cls.matches_spec(jd_text, probe):
                specs.append(probe)
                seen_equiv_keys.update(equiv_keys)

        return specs[:MAX_JD_SKILLS]

    @classmethod
    def evaluate(
        cls,
        base_resume_text: str,
        jd_skills: Sequence[JDSkillSpec],
        approved_replacements: Dict[str, str],
        fallback_before: int = 0,
        fallback_after: int = 0,
    ) -> Tuple[int, int, List[str], List[str]]:
        """
        Returns (score_before, score_after, matched_skills_after, missing_skills_after).
        """
        if not jd_skills:
            effective_after = (
                fallback_before
                if not approved_replacements
                else max(fallback_before, fallback_after)
            )
            return fallback_before, effective_after, [], []

        optimized_text = cls.apply_swaps_to_text(
            base_resume_text, approved_replacements
        )

        total = len(jd_skills)
        before_hits = sum(
            1 for spec in jd_skills if cls.matches_spec(base_resume_text, spec)
        )

        matched_after: List[str] = []
        missing_after: List[str] = []
        for spec in jd_skills:
            if cls.matches_spec(optimized_text, spec):
                matched_after.append(spec.skill)
            else:
                missing_after.append(spec.skill)

        score_before = int(math.floor((before_hits * 100.0) / total + 0.5))
        score_after = int(
            math.floor((len(matched_after) * 100.0) / total + 0.5)
        )
        return score_before, score_after, matched_after, missing_after