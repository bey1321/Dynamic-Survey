# ─── Stage 1: Build the React client ────────────────────────────────────────
FROM node:20-alpine AS client-builder
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
FROM node:20-alpine
WORKDIR /app

# Copy workspace root and shared module
COPY package.json ./
COPY shared/ ./shared/

# Install server dependencies (production only)
COPY server/package.json server/package-lock.json ./server/
RUN npm install --prefix server --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built client assets from Stage 1
COPY --from=client-builder /app/client/dist ./client/dist

EXPOSE 4000

ENV NODE_ENV=production

WORKDIR /app/server

# Use node directly so Docker env vars are picked up (no --env-file needed)
CMD ["node", "index.js"]
