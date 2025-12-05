# ---------------------------------------------------
# STAGE 1: Build
# ---------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Generate Client for the build process
RUN npx prisma generate

# Build NestJS app
RUN npm run build

# ---------------------------------------------------
# STAGE 2: Production
# ---------------------------------------------------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install all dependencies (including dev) so Prisma CLI is available for 'db pull'
COPY package*.json ./
RUN npm ci

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema for introspection/generation
COPY --from=builder /app/prisma ./prisma

# Copy startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 4000

CMD ["./start.sh"]