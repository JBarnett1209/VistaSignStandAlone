FROM node:18-alpine AS build

WORKDIR /app/frontend

# Copy only package manifests first for better layer caching
COPY frontend/package.json ./package.json
COPY frontend/package-lock.json ./package-lock.json

# Install dependencies; fall back to npm install if lock is out-of-sync
RUN npm ci --no-audit --no-fund --legacy-peer-deps || npm install --no-audit --no-fund --legacy-peer-deps

# Copy the rest of the source and build
COPY frontend/ .

# Allow API base URL at build time
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

RUN npm run build

FROM nginx:alpine

# Copy built static assets
COPY --from=build /app/frontend/build /usr/share/nginx/html

# Default nginx.conf will be mounted by docker-compose
# Expose 80 by default (ALB terminates TLS)
EXPOSE 80


