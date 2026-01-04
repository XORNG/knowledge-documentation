FROM node:25-alpine AS builder

WORKDIR /workspace

# Copy entire workspace for monorepo dependency resolution
COPY . .

# Build the template dependencies first
WORKDIR /workspace/template-base
RUN npm ci && npm run build

WORKDIR /workspace/template-knowledge
RUN npm ci && npm run build

# Build this service
WORKDIR /workspace/knowledge-documentation
RUN npm ci && npm run build

# Production stage
FROM node:25-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /workspace/knowledge-documentation/package*.json ./

# Copy built template dependencies into node_modules
COPY --from=builder /workspace/template-base /app/node_modules/@xorng/template-base
COPY --from=builder /workspace/template-knowledge /app/node_modules/@xorng/template-knowledge

# Install only external production dependencies
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts 2>/dev/null || true

# Copy built files
COPY --from=builder /workspace/knowledge-documentation/dist ./dist/

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
