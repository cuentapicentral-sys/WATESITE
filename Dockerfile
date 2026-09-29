FROM node:22-alpine AS frontend

WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
ARG VITE_API_BASE_URL=/api
ARG VITE_SERVICE_API_PREFIX=/services
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SERVICE_API_PREFIX=${VITE_SERVICE_API_PREFIX}
RUN npm run build

FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx gettext-base \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

WORKDIR /app
COPY backend/requirements.txt /tmp/backend-requirements.txt
COPY services/requirements.txt /tmp/services-requirements.txt
RUN pip install --no-cache-dir -r /tmp/backend-requirements.txt -r /tmp/services-requirements.txt

COPY backend ./backend
COPY services ./services
COPY deploy ./deploy
COPY --from=frontend /src/dist /usr/share/nginx/html
COPY deploy/nginx.free.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/start-free.sh /start-free.sh
RUN sed -i 's/\r$//' /start-free.sh && chmod +x /start-free.sh

ENV PORT=10000
EXPOSE 10000
CMD ["/start-free.sh"]
