#!/bin/sh
set -e

# Wait for Postgres to be ready
echo "Waiting for Postgres..."
until pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  echo "Postgres is not ready - sleeping"
  sleep 2
done

echo "Postgres is ready. Starting backend..."

# Start the app
exec npm run dev
