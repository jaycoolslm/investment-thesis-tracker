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

# Build target: compile TypeScript
FROM base AS builder

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm build

# Production target: slim image with compiled JS
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/server.js"]
