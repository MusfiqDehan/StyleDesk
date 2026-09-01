# ── Stage 1: Build ─────────────────────────────────────────────────────────────
# Build tools are required to compile native modules (bcrypt, sharp).
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
# Resolve Nest package peer versions consistently.
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# ── Stage 2: Run ───────────────────────────────────────────────────────────────
# Fresh Alpine image — no build tools, smaller final image.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
# Copy node_modules from builder (native binaries already compiled for Alpine).
COPY --from=builder /app/node_modules ./node_modules
# Strip devDependencies in-place without recompiling native modules.
RUN npm prune --omit=dev --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY migrations ./migrations

# Directory for uploaded files — mount a Docker volume here in production.
RUN mkdir -p uploads

EXPOSE 4000
CMD ["node", "dist/src/main"]
