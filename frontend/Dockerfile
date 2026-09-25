FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG VITE_SERVICE_API_PREFIX=/services
ENV VITE_SERVICE_API_PREFIX=${VITE_SERVICE_API_PREFIX}
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/wastewise.conf.template
COPY render-upstreams.sh /docker-entrypoint.d/40-render-upstreams.sh
RUN chmod +x /docker-entrypoint.d/40-render-upstreams.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80