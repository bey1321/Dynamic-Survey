# ─── Development image ───────────────────────────────────────────────────────
# Runs the client (Vite dev server) and server (with --watch) side by side.
# Source code is bind-mounted by docker-compose, so this image only needs to
# pre-install dependencies and generate the Prisma client.
FROM node:22-bookworm-slim
WORKDIR /app

# Install root dependencies (concurrently)
COPY package.json package-lock.json ./
RUN npm install

# Copy shared module
COPY shared/ ./shared/

# Install server dependencies
COPY server/package.json server/package-lock.json ./server/
RUN npm install --prefix server

# Install client dependencies
COPY client/package.json client/package-lock.json ./client/
RUN npm install --prefix client

# Copy source
COPY . .

# Generate Prisma Client
RUN cd /app/server && npx prisma generate

ENV NODE_ENV=development

EXPOSE 4000 5173

# Apply pending migrations then start both dev servers — DATABASE_URL is
# injected by docker-compose at runtime
CMD ["sh", "-c", "cd server && npx prisma migrate deploy; cd .. && npm run dev:docker"]
