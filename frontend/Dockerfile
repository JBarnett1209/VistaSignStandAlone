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
RUN npm config set registry https://registry.npmjs.org/ && \
    (npm install --no-optional --legacy-peer-deps --verbose || \
     (echo "First install failed, retrying with different approach..." && \
      npm cache clean --force && \
      rm -rf node_modules package-lock.json && \
      npm install --no-optional --legacy-peer-deps --verbose))

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
