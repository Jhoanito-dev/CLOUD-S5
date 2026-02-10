#!/bin/sh
set -e

BACKEND_URL=${BACKEND_URL:-http://backend:3000/health}

echo "Waiting for backend at $BACKEND_URL ..."
while true; do
  if curl -fsS "$BACKEND_URL" >/dev/null 2>&1; then
    break
  fi
  echo "Backend not ready - sleeping"
  sleep 2
done

echo "Backend ready. Starting frontend..."
exec npm run dev
