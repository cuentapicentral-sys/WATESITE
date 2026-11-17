FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
COPY services/requirements.txt ./services/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt -r services/requirements.txt

COPY backend ./backend
COPY services ./services

EXPOSE 8001

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8001"]
