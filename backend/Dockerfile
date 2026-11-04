
FROM python:3.12-slim

# Prevent Python from writing bytecode and enable unbuffered logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Install LibreOffice and required fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.12.3 /uv /uvx /bin/

# Copy dependency files first for better Docker caching
COPY pyproject.toml uv.lock ./

# Install locked production dependencies
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY app/ ./app/

# Create temporary directory
RUN mkdir -p /tmp/resume_optimizer

# Render provides PORT automatically
EXPOSE 10000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
