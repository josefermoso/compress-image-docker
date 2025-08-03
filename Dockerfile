FROM node:20-alpine

# Install build dependencies for Sharp
RUN apk add --no-cache python3 make g++ build-base

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run as non-root user for better security
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser
USER appuser

# Start the application
CMD ["node", "server.js"]
