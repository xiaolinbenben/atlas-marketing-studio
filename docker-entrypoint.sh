#!/bin/sh
set -eu

mkdir -p /app/data
node ./scripts/prepare-migrations.mjs
RUST_LOG="${RUST_LOG:-info}" node ./node_modules/prisma/build/index.js migrate deploy >/dev/null
exec env -u HOSTNAME node server.js
