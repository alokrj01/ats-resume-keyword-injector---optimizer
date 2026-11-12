FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install LibreOffice + metric-compatible fonts for Arial/Times (Liberation) and Calibri/Cambria (Carlito/Caladea)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fontconfig \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /uvx /bin/

# Install locked production dependencies without leaving root cache behind
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --no-cache

# Copy application source
COPY app/ ./app/

# Create non-root user and ensure /home/appuser, /app, and temp workspace are owned by appuser
RUN useradd --create-home --shell /bin/bash appuser \
    && mkdir -p /tmp/ats_resume_workspace \
    && chown -R appuser:appuser /home/appuser /app /tmp/ats_resume_workspace

ENV HOME=/home/appuser
USER appuser

EXPOSE 10000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]