#!/bin/sh
set -eu

PORT="${PORT:-10000}"
export PORT

uvicorn deploy.free_app:app --host 127.0.0.1 --port 8001 &
api_pid=$!

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;' &
nginx_pid=$!

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 2
done

kill "$api_pid" "$nginx_pid" 2>/dev/null || true
wait "$api_pid" 2>/dev/null || true
wait "$nginx_pid" 2>/dev/null || true
exit 1
