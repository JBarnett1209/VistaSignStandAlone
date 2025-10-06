FROM node:18-alpine AS build

WORKDIR /app

# Copy frontend package files and install deps
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY frontend/ ./

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


