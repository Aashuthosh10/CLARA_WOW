FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY packages/*/package*.json ./packages/*/

# Install dependencies
RUN npm ci

# Copy source
COPY apps/server ./apps/server
COPY packages ./packages

# Build
WORKDIR /app/apps/server
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080

CMD ["node", "dist/index.js"]

