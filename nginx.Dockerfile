FROM node:18-alpine

# Install nginx and basic tools
RUN apk add --no-cache nginx bash curl

# Working directory for app
WORKDIR /app

# Prime node modules layer (will be re-used if package files unchanged)
COPY frontend/package.json /app/frontend/package.json
COPY frontend/package-lock.json /app/frontend/package-lock.json
RUN cd /app/frontend \
  && (npm ci --no-audit --no-fund --legacy-peer-deps || npm install --no-audit --no-fund --legacy-peer-deps)

# Copy source (also mounted at runtime by docker-compose for rapid iteration)
COPY frontend/ /app/frontend/

# Allow API base URL at build/start time
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=${REACT_APP_API_URL}

# Provide entrypoint that builds frontend then starts nginx
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Nginx default site will be mounted via docker-compose
EXPOSE 80
CMD ["/entrypoint.sh"]
