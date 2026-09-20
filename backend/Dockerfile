# PAIDI Backend API Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and Prisma schema
COPY prisma ./prisma
COPY src ./src

# Build TypeScript application
RUN npx tsc

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]
