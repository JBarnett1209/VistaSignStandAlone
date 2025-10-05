FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install curl for network debugging
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies with network resilience
ENV NODE_OPTIONS=--max-old-space-size=8192
ENV GENERATE_SOURCEMAP=false
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
RUN npm config set registry https://registry.npmjs.org/ && \
    npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start the application with proper signal handling
CMD ["sh", "-c", "npm start"]
