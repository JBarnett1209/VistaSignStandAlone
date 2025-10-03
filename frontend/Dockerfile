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
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 5 && \
    npm config set timeout 300000 && \
    npm config set network-timeout 300000 && \
    npm install --no-optional --legacy-peer-deps --verbose

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
