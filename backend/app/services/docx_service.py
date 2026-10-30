import asyncio
import re
from copy import deepcopy
from pathlib import Path
from typing import Dict
from docx import Document
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from app.core.config import settings

SPECIAL_XML_TAGS = {"drawing", "pict", "br", "tab"}
SECTION_HEADERS = {"PROFESSIONAL SUMMARY", "SKILLS", "EXPERIENCE", "EDUCATION", "PROJECTS", "CERTIFICATIONS"}

class DocxService:
    @staticmethod
    def _have_same_formatting(run1: Run, run2: Run) -> bool:
        if (run1.bold != run2.bold or 
            run1.italic != run2.italic or 
            run1.underline != run2.underline):
            return False

        f1, f2 = run1.font, run2.font
        if (f1.name != f2.name or 
            f1.size != f2.size or 
            f1.strike != f2.strike or 
            f1.subscript != f2.subscript or 
            f1.superscript != f2.superscript):
            return False

        color1 = f1.color.rgb if f1.color else None
        color2 = f2.color.rgb if f2.color else None
        return color1 == color2

    @staticmethod
    def _has_special_children(run: Run) -> bool:
        for child in run._r:
            local_name = child.tag.rsplit("}", 1)[-1]
            if local_name in SPECIAL_XML_TAGS:
                return True
        return False

    @classmethod
    def _merge_runs_in_paragraph(cls, paragraph: Paragraph) -> None:
        runs = paragraph.runs
        if len(runs) <= 1:
            return

        current_run = runs[0]
        for next_run in runs[1:]:
            if not cls._has_special_children(next_run) and cls._have_same_formatting(current_run, next_run):
                current_run.text += next_run.text
                paragraph._p.remove(next_run._r)
            else:
                current_run = next_run

    @classmethod
    def normalize_and_extract_text(cls, doc: Document) -> str:
        chunks = []
        for paragraph in doc.paragraphs:
            cls._merge_runs_in_paragraph(paragraph)
            txt = paragraph.text.strip()
            if txt:
                chunks.append(txt)

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        cls._merge_runs_in_paragraph(paragraph)
                        txt = paragraph.text.strip()
                        if txt:
                            chunks.append(txt)

        for section in doc.sections:
            for paragraph in section.header.paragraphs:
                cls._merge_runs_in_paragraph(paragraph)
            for paragraph in section.footer.paragraphs:
                cls._merge_runs_in_paragraph(paragraph)

        return "\n".join(chunks)

    @staticmethod
    def _should_allow_bold_highlights(paragraph_text: str, current_section: str) -> bool:
        """
        Blocks bold highlighting inside the SKILLS section, CERTIFICATION section,
        pipe-separated skill lists (|), or 'Tech Stack:' lines.
        """
        p_clean = paragraph_text.strip()
        if current_section in {"SKILLS", "CERTIFICATIONS", "EDUCATION"}:
            return False
        if "|" in p_clean or p_clean.lower().startswith("tech stack:"):
            return False
        return True

    @staticmethod
    def _set_run_text_with_highlights(
        paragraph: Paragraph, target_run: Run, updated_text: str, allow_bold: bool = True
    ) -> None:
        # If bolding is not allowed in this section (e.g. SKILLS), strip ** and keep original style
        if not allow_bold:
            target_run.text = updated_text.replace("**", "")
            return

        if "**" not in updated_text:
            target_run.text = updated_text
            return

        tokens = re.split(r"(\*\*.*?\*\*)", updated_text)
        tokens = [t for t in tokens if t]

        if not tokens:
            target_run.text = ""
            return

        anchor_r = target_run._r
        base_rPr = deepcopy(anchor_r.rPr) if anchor_r.rPr is not None else None

        for idx, token in enumerate(tokens):
            is_highlighted = token.startswith("**") and token.endswith("**") and len(token) > 4
            clean_text = token[2:-2] if is_highlighted else token

            if idx == 0:
                target_run.text = clean_text
                if is_highlighted:
                    target_run.bold = True
            else:
                new_run = paragraph.add_run(clean_text)
                if base_rPr is not None:
                    if new_run._r.rPr is not None:
                        new_run._r.remove(new_run._r.rPr)
                    new_run._r.insert(0, deepcopy(base_rPr))
                if is_highlighted:
                    new_run.bold = True

                anchor_r.addnext(new_run._r)
                anchor_r = new_run._r

    @classmethod
    def _replace_in_paragraph(
        cls, paragraph: Paragraph, replacements: Dict[str, str], current_section: str
    ) -> None:
        p_text = paragraph.text
        if not p_text:
            return

        allow_bold = cls._should_allow_bold_highlights(p_text, current_section)

        for old_text, new_text in replacements.items():
            if old_text in paragraph.text:
                # If bolding isn't allowed here, clean ** out of the replacement string
                effective_new_text = new_text if allow_bold else new_text.replace("**", "")
                replaced_in_run = False

                for run in list(paragraph.runs):
                    if old_text in run.text:
                        updated_run_text = run.text.replace(old_text, effective_new_text)
                        cls._set_run_text_with_highlights(
                            paragraph, run, updated_run_text, allow_bold=allow_bold
                        )
                        replaced_in_run = True

                if not replaced_in_run and paragraph.runs:
                    base_run = paragraph.runs[0]
                    full_updated = paragraph.text.replace(old_text, effective_new_text)
                    for run in paragraph.runs[1:]:
                        run.text = ""
                    cls._set_run_text_with_highlights(
                        paragraph, base_run, full_updated, allow_bold=allow_bold
                    )

    @classmethod
    def apply_replacements(cls, doc: Document, replacements: Dict[str, str]) -> Document:
        current_section = ""

        for paragraph in doc.paragraphs:
            upper_txt = paragraph.text.strip().upper()
            if upper_txt in SECTION_HEADERS:
                current_section = upper_txt
            cls._replace_in_paragraph(paragraph, replacements, current_section)

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        upper_txt = paragraph.text.strip().upper()
                        if upper_txt in SECTION_HEADERS:
                            current_section = upper_txt
                        cls._replace_in_paragraph(paragraph, replacements, current_section)
        return doc

    @staticmethod
    async def convert_to_pdf_async(docx_path: Path) -> Path:
        output_dir = docx_path.parent
        lo_profile = f"file://{settings.TEMP_DIR}/lo_profile"

        proc = await asyncio.create_subprocess_exec(
            "libreoffice",
            f"-env:UserInstallation={lo_profile}",
            "--headless",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--convert-to",
            "pdf",
            str(docx_path),
            "--outdir",
            str(output_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        return docx_path.with_suffix(".pdf")