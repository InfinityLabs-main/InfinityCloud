FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем backend-код (нужен для моделей и сервисов)
COPY . .

CMD ["celery", "-A", "tasks.celery_app", "worker", "-l", "info"]
