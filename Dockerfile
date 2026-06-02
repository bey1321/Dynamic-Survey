# ─── Stage 1: Build the React client ────────────────────────────────────────
FROM node:22-bookworm-slim AS client-builder
WORKDIR /app

# Copy workspace root (needed for the "file:.." shared dependency)
COPY package.json ./
COPY shared/ ./shared/

# Install client dependencies
COPY client/package.json client/package-lock.json ./client/
RUN npm install --prefix client

# Build the production bundle
COPY client/ ./client/
RUN npm run build --prefix client

# ─── Stage 2: Production server ──────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app

# Copy workspace root and shared module
COPY package.json ./
COPY shared/ ./shared/

# Install server production dependencies
COPY server/package.json server/package-lock.json ./server/
RUN npm install --prefix server

# Copy server source (includes prisma/ schema and prisma.config.ts)
COPY server/ ./server/

# Generate Prisma Client
RUN cd /app/server && npx prisma generate

# Copy built client assets from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 4000

ENV NODE_ENV=production

WORKDIR /app/server

# Run migrations then start — DATABASE_URL is injected by docker-compose at runtime
CMD ["sh", "-c", "npx prisma migrate deploy && node index.js"]
