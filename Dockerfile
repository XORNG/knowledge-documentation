FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Create docs directory
RUN mkdir -p /docs

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /docs

USER nodejs

# Environment variables
ENV DOCS_PATH=/docs
ENV LOG_LEVEL=info

# MCP server uses stdio
CMD ["node", "dist/index.js"]
