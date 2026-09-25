FROM python:3.12-slim

WORKDIR /app

COPY services/requirements.txt ./services/requirements.txt
RUN pip install --no-cache-dir -r services/requirements.txt

COPY services ./services

ARG SERVICE_MODULE
ENV SERVICE_MODULE=${SERVICE_MODULE}

EXPOSE 8000

CMD ["python", "/app/services/start.py"]