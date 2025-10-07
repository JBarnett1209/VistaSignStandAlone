#!/usr/bin/env sh
set -e

# Build the frontend on every container start so `docker-compose restart` picks up changes
echo "Building frontend..."
cd /app/frontend
export NODE_OPTIONS=--max-old-space-size=8192
export GENERATE_SOURCEMAP=false
npm run build

# Copy build to nginx html root
mkdir -p /usr/share/nginx/html
cp -r /app/frontend/build/* /usr/share/nginx/html/

# Start nginx in foreground
echo "Starting nginx..."
exec nginx -g 'daemon off;'


