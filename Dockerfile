FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Development target: all deps, hot reload via tsx watch
FROM base AS dev

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3001
CMD ["pnpm", "dev"]

# Build target: compile backend + frontend
FROM base AS builder

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# Build frontend
COPY web/ ./web/
RUN cd web && pnpm install --frozen-lockfile && pnpm build

# Production target: slim image with compiled backend + frontend
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Full install (not --prod) so @openai/codex platform binary is included
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 3001
CMD ["node", "dist/server.js"]
