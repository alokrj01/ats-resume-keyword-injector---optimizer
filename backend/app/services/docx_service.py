import asyncio
import logging
import os
import re
import shutil
import signal
import tempfile
import xml.etree.ElementTree as ET
import zipfile
import zlib
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Set, Tuple

from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from docx.oxml import OxmlElement
from docx.shared import Pt
from docx.table import Table
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from fastapi import HTTPException
from lxml import etree

from app.core.config import settings

logger = logging.getLogger(__name__)

SAFE_INTERVENING_XML_TAGS = {"proofErr", "bookmarkStart", "bookmarkEnd"}

SECTION_PATTERNS: List[Tuple[str, Tuple[str, ...]]] = [
    (
        "SUMMARY",
        (
            "SUMMARY",
            "PROFESSIONAL SUMMARY",
            "EXECUTIVE SUMMARY",
            "PROFILE",
            "PROFESSIONAL PROFILE",
            "ABOUT ME",
            "OBJECTIVE",
            "CAREER OBJECTIVE",
            "CAREER SUMMARY",
        ),
    ),
    (
        "SKILLS",
        (
            "SKILLS",
            "TECHNICAL SKILLS",
            "CORE SKILLS",
            "KEY SKILLS",
            "CORE COMPETENCIES",
            "COMPETENCIES",
            "TECHNOLOGIES",
            "SKILLS & TOOLS",
            "SKILLS AND TOOLS",
            "SKILLS & TECHNOLOGIES",
            "SKILLS AND TECHNOLOGIES",
            "TECH STACK",
            "TECHNICAL PROFICIENCIES",
            "AREAS OF EXPERTISE",
        ),
    ),
    (
        "EXPERIENCE",
        (
            "EXPERIENCE",
            "WORK EXPERIENCE",
            "PROFESSIONAL EXPERIENCE",
            "RELEVANT EXPERIENCE",
            "EMPLOYMENT HISTORY",
            "WORK HISTORY",
            "CAREER HISTORY",
            "INTERNSHIP",
            "INTERNSHIPS",
            "INDUSTRY EXPERIENCE",
        ),
    ),
    (
        "PROJECTS",
        (
            "PROJECTS",
            "PERSONAL PROJECTS",
            "ACADEMIC PROJECTS",
            "KEY PROJECTS",
            "TECHNICAL PROJECTS",
            "SELECTED PROJECTS",
            "FEATURED PROJECTS",
            "PROJECT EXPERIENCE",
        ),
    ),
    (
        "EDUCATION",
        (
            "EDUCATION",
            "ACADEMIC BACKGROUND",
            "ACADEMIC QUALIFICATIONS",
            "EDUCATION & TRAINING",
            "EDUCATION AND TRAINING",
            "QUALIFICATIONS",
        ),
    ),
    (
        "CERTIFICATIONS",
        (
            "CERTIFICATIONS",
            "CERTIFICATES",
            "LICENSES & CERTIFICATIONS",
            "LICENSES AND CERTIFICATIONS",
            "CERTIFICATIONS & AWARDS",
            "CERTIFICATIONS AND AWARDS",
            "AWARDS & ACHIEVEMENTS",
            "ACHIEVEMENTS",
            "HONORS & AWARDS",
            "PUBLICATIONS",
        ),
    ),
]

MAX_DOCX_COMPRESSED_BYTES = 10 * 1024 * 1024      # 10 MB max .docx file size
MAX_DOCX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024    # 30 MB max decompressed size (anti-ZIP-bomb)
MAX_RELS_BYTES = 1 * 1024 * 1024                  # 1 MB max .rels XML size
MAX_ZIP_ENTRIES = 500
PDF_CONVERT_TIMEOUT_SECONDS = 45.0
MAX_CONCURRENT_PDF_JOBS = 2


class DocxService:
    _pdf_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PDF_JOBS)

    # ---------------------------------------------------------
    # P0 Security: Validate .docx archive before parsing/rendering
    # ---------------------------------------------------------

    @staticmethod
    def validate_docx_file(docx_path: Path) -> None:
        if not docx_path.is_file():
            raise HTTPException(status_code=404, detail="Resume file not found.")

        file_size = docx_path.stat().st_size
        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded .docx file is empty.")
        if file_size > MAX_DOCX_COMPRESSED_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Uploaded .docx file exceeds the 10 MB size limit.",
            )

        try:
            with zipfile.ZipFile(docx_path, "r") as zf:
                infos = zf.infolist()
                if len(infos) > MAX_ZIP_ENTRIES:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid .docx archive: too many internal entries.",
                    )

                names = {info.filename for info in infos}
                has_word_xml = any(
                    n.startswith("word/") and n.endswith(".xml") for n in names
                )
                if "[Content_Types].xml" not in names or not has_word_xml:
                    raise HTTPException(
                        status_code=400,
                        detail="Uploaded file is not a valid Word (.docx) document.",
                    )

                total_uncompressed = 0
                for info in infos:
                    lower_name = info.filename.lower()
                    if lower_name.endswith("vbaproject.bin"):
                        raise HTTPException(
                            status_code=400,
                            detail="Macro-enabled Word documents (.docm) are not allowed.",
                        )

                    is_rels = lower_name.endswith(".rels")
                    rels_buf = bytearray() if is_rels else None

                    with zf.open(info, "r") as member:
                        while chunk := member.read(65536):
                            total_uncompressed += len(chunk)
                            if total_uncompressed > MAX_DOCX_UNCOMPRESSED_BYTES:
                                raise HTTPException(
                                    status_code=400,
                                    detail="Invalid .docx file: uncompressed content exceeds safety limit.",
                                )
                            if rels_buf is not None:
                                rels_buf.extend(chunk)
                                if len(rels_buf) > MAX_RELS_BYTES:
                                    raise HTTPException(
                                        status_code=400,
                                        detail="Invalid .docx file: oversized relationship metadata.",
                                    )

                    if rels_buf is not None:
                        root = ET.fromstring(bytes(rels_buf))
                        for rel in root.iter():
                            if rel.tag.endswith("Relationship"):
                                target_mode = (
                                    rel.attrib.get("TargetMode") or ""
                                ).strip().lower()
                                rel_type = (
                                    rel.attrib.get("Type") or ""
                                ).strip().lower()
                                if target_mode == "external" and not rel_type.endswith(
                                    "/hyperlink"
                                ):
                                    raise HTTPException(
                                        status_code=400,
                                        detail="Documents with external templates or remote embedded objects are not allowed.",
                                    )

        except HTTPException:
            raise
        except (
            zipfile.BadZipFile,
            NotImplementedError,
            RuntimeError,
            EOFError,
            zlib.error,
        ) as exc:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is corrupted or not a valid .docx archive.",
            ) from exc
        except ET.ParseError as exc:
            raise HTTPException(
                status_code=400,
                detail="Uploaded .docx contains malformed XML metadata.",
            ) from exc

    @classmethod
    def load_document(cls, docx_path: Path) -> Document:
        """Validate .docx safety first, then open cleanly with python-docx."""
        cls.validate_docx_file(docx_path)
        try:
            return Document(str(docx_path))
        except (
            PackageNotFoundError,
            KeyError,
            ValueError,
            OSError,
            etree.XMLSyntaxError,
        ) as exc:
            logger.warning("Failed to open .docx file: %s", type(exc).__name__)
            raise HTTPException(
                status_code=400,
                detail="Unable to read .docx file. Please re-save it as a standard Word (.docx) document.",
            ) from exc

    # ---------------------------------------------------------
    # P1 Precision: True document-order traversal & XML run merge
    # ---------------------------------------------------------

    @staticmethod
    def _local_tag(el) -> str:
        return el.tag.rsplit("}", 1)[-1]

    @classmethod
    def _is_plain_text_run(cls, run: Run) -> bool:
        for child in run._r:
            if cls._local_tag(child) not in {"rPr", "t"}:
                return False
        return True

    @staticmethod
    def _rpr_signature(run: Run) -> bytes:
        rPr = run._r.rPr
        if rPr is None:
            return b""
        return etree.tostring(rPr, encoding="utf-8")

    @classmethod
    def _are_merge_safe_siblings(cls, run1: Run, run2: Run) -> bool:
        """Never merge runs across a <w:hyperlink> or field boundary."""
        node = run1._r.getnext()
        while node is not None and node is not run2._r:
            if cls._local_tag(node) not in SAFE_INTERVENING_XML_TAGS:
                return False
            node = node.getnext()
        return node is run2._r

    @classmethod
    def _merge_run_sequence(cls, runs: List[Run]) -> None:
        if len(runs) <= 1:
            return
        current_run = runs[0]
        for next_run in runs[1:]:
            if (
                cls._is_plain_text_run(current_run)
                and cls._is_plain_text_run(next_run)
                and cls._are_merge_safe_siblings(current_run, next_run)
                and cls._rpr_signature(current_run) == cls._rpr_signature(next_run)
            ):
                current_run.text += next_run.text
                next_run._r.getparent().remove(next_run._r)
            else:
                current_run = next_run

    @classmethod
    def _merge_runs_in_paragraph(cls, paragraph: Paragraph) -> None:
        cls._merge_run_sequence(paragraph.runs)
        for hyperlink in paragraph.hyperlinks:
            cls._merge_run_sequence(hyperlink.runs)

    @classmethod
    def _iter_txbx_paragraphs(
        cls, paragraph: Paragraph, seen: Set[Any]
    ) -> Iterator[Paragraph]:
        for el in paragraph._p.iter():
            if cls._local_tag(el) == "txbxContent" and el not in seen:
                seen.add(el)
                for child in el:
                    tag = cls._local_tag(child)
                    if tag == "p":
                        yield Paragraph(child, paragraph._parent)
                    elif tag == "tbl":
                        sub_tbl = Table(child, paragraph._parent)
                        yield from cls._iter_table_paragraphs(sub_tbl, seen)

    @classmethod
    def _iter_table_paragraphs(
        cls, table: Table, seen: Set[Any]
    ) -> Iterator[Paragraph]:
        for row in table.rows:
            for cell in row.cells:
                tc = cell._tc
                if tc in seen:
                    continue
                seen.add(tc)
                yield from cls._iter_container_paragraphs(cell, seen)

    @classmethod
    def _iter_container_paragraphs(
        cls, container, seen: Set[Any]
    ) -> Iterator[Paragraph]:
        for item in container.iter_inner_content():
            if isinstance(item, Paragraph):
                yield item
                yield from cls._iter_txbx_paragraphs(item, seen)
            elif isinstance(item, Table):
                yield from cls._iter_table_paragraphs(item, seen)

    @classmethod
    def _iter_document_paragraphs(
        cls, doc: Document
    ) -> Iterator[Tuple[Paragraph, bool]]:
        seen: Set[Any] = set()

        for section in doc.sections:
            if not section.header.is_linked_to_previous:
                for p in cls._iter_container_paragraphs(section.header, seen):
                    yield p, True

        for p in cls._iter_container_paragraphs(doc, seen):
            yield p, True

        for section in doc.sections:
            if not section.footer.is_linked_to_previous:
                for p in cls._iter_container_paragraphs(section.footer, seen):
                    yield p, False

    @classmethod
    def normalize_and_extract_text(cls, doc: Document) -> str:
        chunks: List[str] = []
        for paragraph, include_text in cls._iter_document_paragraphs(doc):
            cls._merge_runs_in_paragraph(paragraph)
            if include_text:
                txt = paragraph.text.strip()
                if txt:
                    chunks.append(txt)
        return "\n".join(chunks)

    # ---------------------------------------------------------
    # P1 Precision: Fuzzy section detection & run-span splicing
    # ---------------------------------------------------------

    @staticmethod
    def _detect_section(paragraph: Paragraph) -> Optional[str]:
        raw = paragraph.text.strip()
        if not raw or len(raw) > 60:
            return None

        cleaned = re.sub(r"^[\s•▪◦\-–—|]+|[\s:|\-–—]+$", "", raw).strip()
        if not cleaned or ":" in cleaned:
            return None

        upper = re.sub(r"\s+", " ", cleaned.upper())
        words = upper.split()
        if len(words) > 6 or upper.endswith("."):
            return None

        for canonical, aliases in SECTION_PATTERNS:
            if upper in aliases:
                return canonical

        style_name = (paragraph.style.name if paragraph.style else "") or ""
        is_heading_style = style_name.lower().startswith("heading")
        is_short_all_caps = (
            1 <= len(words) <= 4
            and cleaned == cleaned.upper()
            and any(ch.isalpha() for ch in cleaned)
        )
        if is_heading_style or is_short_all_caps:
            return "OTHER"

        return None

    @staticmethod
    def _should_allow_bold_highlights(
        paragraph_text: str, current_section: str
    ) -> bool:
        """
        Only allow new **bold** highlights inside EXPERIENCE or PROJECTS bullets.
        Blocks bold injection inside SUMMARY, SKILLS, CERTIFICATIONS, EDUCATION, or Tech Stack lines.
        """
        p_clean = paragraph_text.strip()
        if current_section in {"SUMMARY", "SKILLS", "CERTIFICATIONS", "EDUCATION"}:
            return False
        lower_clean = p_clean.lower()
        if "|" in p_clean or lower_clean.startswith(
            ("tech stack:", "technologies:", "tools:")
        ):
            return False
        return True

    @classmethod
    def _iter_plain_run_subgroups(cls, runs: List[Run]) -> Iterator[List[Run]]:
        group: List[Run] = []
        for r in runs:
            if cls._is_plain_text_run(r):
                group.append(r)
            else:
                if group:
                    yield group
                    group = []
        if group:
            yield group

    @classmethod
    def _iter_contiguous_run_groups(
        cls, paragraph: Paragraph
    ) -> Iterator[List[Run]]:
        """
        Yield contiguous groups of plain-text runs, treating hyperlinks and
        non-plain-text runs (<w:drawing>, <w:fldChar>, <w:tab>, <w:br>, etc.)
        as strict boundaries so non-text XML nodes are never swallowed or deleted.
        """
        current_group: List[Run] = []
        for item in paragraph.iter_inner_content():
            if isinstance(item, Run):
                if cls._is_plain_text_run(item):
                    current_group.append(item)
                else:
                    if current_group:
                        yield current_group
                        current_group = []
            elif isinstance(item, Hyperlink):
                if current_group:
                    yield current_group
                    current_group = []
                if item.runs:
                    yield from cls._iter_plain_run_subgroups(list(item.runs))
        if current_group:
            yield current_group

    @staticmethod
    def _build_match_pattern(old_text: str) -> re.Pattern:
        escaped = re.escape(old_text)
        prefix = (
            r"(?<!\w)"
            if (old_text and (old_text[0].isalnum() or old_text[0] == "_"))
            else ""
        )
        suffix = (
            r"(?!\w)"
            if (old_text and (old_text[-1].isalnum() or old_text[-1] == "_"))
            else ""
        )
        return re.compile(f"{prefix}{escaped}{suffix}")

    @staticmethod
    def _tokenize_replacement(
        text: str, allow_bold: bool
    ) -> List[Tuple[str, bool]]:
        if not allow_bold or "**" not in text:
            clean = text.replace("**", "")
            return [(clean, False)] if clean else []

        parts = re.split(r"(\*\*.*?\*\*)", text)
        tokens: List[Tuple[str, bool]] = []
        for part in parts:
            if not part:
                continue
            if part.startswith("**") and part.endswith("**") and len(part) > 4:
                tokens.append((part[2:-2], True))
            else:
                plain = part.replace("**", "")
                if plain:
                    tokens.append((plain, False))
        return tokens

    @staticmethod
    def _create_formatted_run(
        text: str, base_rPr, make_bold: bool, parent
    ) -> Run:
        r_el = OxmlElement("w:r")
        if base_rPr is not None:
            r_el.append(deepcopy(base_rPr))
        new_run = Run(r_el, parent)
        new_run.text = text
        if make_bold:
            new_run.bold = True
        return new_run

    @classmethod
    def _splice_run_group(
        cls,
        run_group: List[Run],
        sorted_replacements: List[Tuple[str, str]],
        allow_bold: bool,
    ) -> bool:
        if not run_group or not sorted_replacements:
            return False

        live_runs = list(run_group)
        full_text = "".join(r.text for r in live_runs)
        if not full_text:
            return False

        planned: List[Tuple[int, int, str]] = []
        for old_text, new_text in sorted_replacements:
            if old_text not in full_text:
                continue
            pattern = cls._build_match_pattern(old_text)
            matches = list(pattern.finditer(full_text))
            spans = [(m.start(), m.end()) for m in matches]

            for s, e in spans:
                if any(not (e <= ps or s >= pe) for ps, pe, _ in planned):
                    continue
                planned.append((s, e, new_text))

        if not planned:
            return False

        # Apply from right to left so earlier character offsets remain valid
        planned.sort(key=lambda item: item[0], reverse=True)

        for match_start, match_end, new_text in planned:
            offsets: List[Tuple[int, int, int, Run]] = []
            pos = 0
            for idx, r in enumerate(live_runs):
                end = pos + len(r.text)
                offsets.append((idx, pos, end, r))
                pos = end

            # Require strictly positive character overlap so zero-length runs are never matched
            overlapping = [
                item
                for item in offsets
                if min(item[2], match_end) > max(item[1], match_start)
            ]
            if not overlapping:
                continue

            first_idx, first_start, _, first_run = overlapping[0]
            last_idx, last_start, _, last_run = overlapping[-1]

            spanned_runs = live_runs[first_idx : last_idx + 1]
            if not all(cls._is_plain_text_run(r) for r in spanned_runs):
                continue

            dominant_run = max(
                overlapping,
                key=lambda item: min(item[2], match_end)
                - max(item[1], match_start),
            )[3]
            dominant_rPr = (
                deepcopy(dominant_run._r.rPr)
                if dominant_run._r.rPr is not None
                else None
            )

            parent_ref = first_run._parent

            first_rPr = (
                deepcopy(first_run._r.rPr)
                if first_run._r.rPr is not None
                else dominant_rPr
            )
            last_rPr = (
                deepcopy(last_run._r.rPr)
                if last_run._r.rPr is not None
                else dominant_rPr
            )

            prefix_text = first_run.text[: match_start - first_start]
            suffix_text = last_run.text[match_end - last_start :]

            replacement_runs: List[Run] = []
            if prefix_text:
                replacement_runs.append(
                    cls._create_formatted_run(
                        prefix_text, first_rPr, False, parent_ref
                    )
                )

            for tok_text, is_bold in cls._tokenize_replacement(
                new_text, allow_bold=allow_bold
            ):
                replacement_runs.append(
                    cls._create_formatted_run(
                        tok_text, dominant_rPr, is_bold, parent_ref
                    )
                )

            if suffix_text:
                replacement_runs.append(
                    cls._create_formatted_run(
                        suffix_text, last_rPr, False, parent_ref
                    )
                )

            anchor = first_run._r
            for new_r in reversed(replacement_runs):
                anchor.addnext(new_r._r)

            for old_r in spanned_runs:
                parent_el = old_r._r.getparent()
                if parent_el is not None:
                    parent_el.remove(old_r._r)

            live_runs[first_idx : last_idx + 1] = replacement_runs

        return True

    @classmethod
    def _replace_in_paragraph(
        cls,
        paragraph: Paragraph,
        sorted_replacements: List[Tuple[str, str]],
        current_section: str,
    ) -> None:
        p_text = paragraph.text
        if not p_text or not sorted_replacements:
            return

        allow_bold = cls._should_allow_bold_highlights(p_text, current_section)
        changed = False

        for run_group in cls._iter_contiguous_run_groups(paragraph):
            if cls._splice_run_group(run_group, sorted_replacements, allow_bold):
                changed = True

        if changed:
            cls._merge_runs_in_paragraph(paragraph)

    @classmethod
    def apply_replacements(
        cls, doc: Document, replacements: Dict[str, str]
    ) -> Document:
        sorted_replacements = sorted(
            (
                (k.strip(), v.strip())
                for k, v in replacements.items()
                if isinstance(k, str)
                and isinstance(v, str)
                and k.strip()
                and v.strip()
            ),
            key=lambda kv: len(kv[0]),
            reverse=True,
        )
        if not sorted_replacements:
            return doc

        current_section = ""
        for paragraph, _ in cls._iter_document_paragraphs(doc):
            detected = cls._detect_section(paragraph)
            if detected is not None:
                current_section = detected
            cls._replace_in_paragraph(
                paragraph, sorted_replacements, current_section
            )

        return doc

    # ---------------------------------------------------------
    # Single-Page Spill Guard & Isolated LibreOffice PDF Render
    # ---------------------------------------------------------

    @staticmethod
    def _count_pdf_pages(pdf_path: Path) -> int:
        data = pdf_path.read_bytes()
        return len(re.findall(rb"/Type\s*/Page(?![sA-Za-z])", data))

    @classmethod
    def _tighten_vertical_margins_for_single_page(cls, docx_path: Path) -> bool:
        """
        Compensates for LibreOffice Writer's taller default header/footer reserve
        when a 1-page resume overflows onto Page 2 by 1-3 lines.
        """
        doc = Document(str(docx_path))
        word_count = sum(
            len(p.text.split())
            for p, include in cls._iter_document_paragraphs(doc)
            if include
        )
        if word_count > 850:
            return False

        default_margin_emu = int(0.75 * 914400)
        min_margin_emu = int(0.22 * 914400)  # ~16 pt minimum margin
        min_hf_emu = int(0.10 * 914400)      # ~7 pt header/footer distance
        changed = False

        for section in doc.sections:
            cur_top = (
                section.top_margin
                if section.top_margin is not None
                else default_margin_emu
            )
            cur_bottom = (
                section.bottom_margin
                if section.bottom_margin is not None
                else default_margin_emu
            )

            if cur_top > min_margin_emu:
                section.top_margin = max(min_margin_emu, int(cur_top * 0.55))
                changed = True
            if cur_bottom > min_margin_emu:
                section.bottom_margin = max(
                    min_margin_emu, int(cur_bottom * 0.55)
                )
                changed = True

            cur_hd = (
                section.header_distance
                if section.header_distance is not None
                else int(0.5 * 914400)
            )
            cur_fd = (
                section.footer_distance
                if section.footer_distance is not None
                else int(0.5 * 914400)
            )
            if cur_hd > min_hf_emu:
                section.header_distance = min_hf_emu
                changed = True
            if cur_fd > min_hf_emu:
                section.footer_distance = min_hf_emu
                changed = True

        for p, include in cls._iter_document_paragraphs(doc):
            if not include:
                continue
            pf = p.paragraph_format
            if pf.space_after and pf.space_after > Pt(2):
                pf.space_after = int(pf.space_after * 0.8)
                changed = True

        if changed:
            doc.save(str(docx_path))
        return changed

    @classmethod
    def _prepare_pdf_render(cls, docx_path: Path) -> Tuple[str, Path]:
        cls.validate_docx_file(docx_path)

        lo_bin = shutil.which("libreoffice") or shutil.which("soffice")
        if not lo_bin:
            logger.error(
                "LibreOffice binary ('libreoffice' or 'soffice') not found on PATH."
            )
            raise HTTPException(
                status_code=503,
                detail="PDF rendering engine (LibreOffice) is not installed on the server.",
            )

        pdf_path = docx_path.with_suffix(".pdf")
        if pdf_path.exists():
            pdf_path.unlink(missing_ok=True)

        settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        return lo_bin, pdf_path

    @classmethod
    def _verify_and_count_pdf_pages(cls, pdf_path: Path) -> int:
        if not pdf_path.is_file() or pdf_path.stat().st_size == 0:
            logger.error("LibreOffice exited 0 but output PDF was missing or empty.")
            raise HTTPException(
                status_code=500,
                detail="PDF generation produced an empty file.",
            )
        return cls._count_pdf_pages(pdf_path)

    @classmethod
    def _prepare_single_page_refit_copy(
        cls, source_docx: Path, refit_docx: Path
    ) -> bool:
        shutil.copyfile(source_docx, refit_docx)
        return cls._tighten_vertical_margins_for_single_page(refit_docx)

    @staticmethod
    def _safe_unlink(path: Path) -> None:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    @staticmethod
    def _terminate_process_tree(proc: asyncio.subprocess.Process) -> None:
        if proc.returncode is not None:
            return
        try:
            if os.name == "posix" and proc.pid:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            else:
                proc.kill()
        except ProcessLookupError:
            pass
        except Exception:
            try:
                proc.kill()
            except ProcessLookupError:
                pass

    @classmethod
    async def convert_to_pdf_async(
        cls, docx_path: Path, _allow_refit: bool = True
    ) -> Path:
        lo_bin, pdf_path = await asyncio.to_thread(
            cls._prepare_pdf_render, docx_path
        )
        output_dir = docx_path.parent
        popen_kwargs = {"start_new_session": True} if os.name == "posix" else {}

        async with cls._pdf_semaphore:
            with tempfile.TemporaryDirectory(
                dir=settings.TEMP_DIR,
                prefix="lo_profile_",
                ignore_cleanup_errors=True,
            ) as profile_dir:
                lo_profile_uri = Path(profile_dir).as_uri()

                proc = await asyncio.create_subprocess_exec(
                    lo_bin,
                    f"-env:UserInstallation={lo_profile_uri}",
                    "--headless",
                    "--nologo",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--norestore",
                    "--nolockcheck",
                    "--convert-to",
                    "pdf",
                    str(docx_path),
                    "--outdir",
                    str(output_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    **popen_kwargs,
                )

                try:
                    stdout, stderr = await asyncio.wait_for(
                        proc.communicate(),
                        timeout=PDF_CONVERT_TIMEOUT_SECONDS,
                    )
                except asyncio.TimeoutError as exc:
                    cls._terminate_process_tree(proc)
                    await proc.wait()
                    logger.error(
                        "LibreOffice conversion timed out after %.1fs.",
                        PDF_CONVERT_TIMEOUT_SECONDS,
                    )
                    raise HTTPException(
                        status_code=504,
                        detail="PDF generation timed out. Please try again.",
                    ) from exc
                except BaseException:
                    cls._terminate_process_tree(proc)
                    await proc.wait()
                    raise

                if proc.returncode != 0:
                    err_msg = (stderr or stdout or b"").decode(
                        "utf-8", errors="replace"
                    )[:500]
                    logger.error(
                        "LibreOffice exited with code %s: %s",
                        proc.returncode,
                        err_msg,
                    )
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to convert optimized resume to PDF.",
                    )

        page_count = await asyncio.to_thread(
            cls._verify_and_count_pdf_pages, pdf_path
        )

        if _allow_refit and page_count == 2:
            refit_docx = docx_path.with_name(f"{docx_path.stem}_refit.docx")
            refit_pdf = refit_docx.with_suffix(".pdf")
            try:
                can_refit = await asyncio.to_thread(
                    cls._prepare_single_page_refit_copy, docx_path, refit_docx
                )
                if can_refit:
                    refit_pdf = await cls.convert_to_pdf_async(
                        refit_docx, _allow_refit=False
                    )
                    refit_pages = await asyncio.to_thread(
                        cls._count_pdf_pages, refit_pdf
                    )
                    if refit_pages == 1:
                        logger.info(
                            "Single-page refit succeeded; using 1-page PDF."
                        )
                        await asyncio.to_thread(
                            os.replace, refit_pdf, pdf_path
                        )
                    else:
                        logger.info(
                            "Document remains %d pages after refit; keeping original layout.",
                            refit_pages,
                        )
            finally:
                await asyncio.to_thread(cls._safe_unlink, refit_docx)
                await asyncio.to_thread(cls._safe_unlink, refit_pdf)

        return pdf_path