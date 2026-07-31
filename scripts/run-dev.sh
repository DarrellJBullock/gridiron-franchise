#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
if [ -f .dev-db-url.txt ]; then
  export DATABASE_URL="$(cat .dev-db-url.txt)"
fi
exec npx next dev
