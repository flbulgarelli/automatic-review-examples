# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20

# -------- base: node + pnpm vía corepack --------
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

# -------- deps (todas: incluye devDeps para buildear) --------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# -------- build: compila TS a dist/ --------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY src ./src
RUN pnpm build

# -------- prod-deps: sólo deps de runtime --------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod

# -------- runtime --------
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build    /app/dist         ./dist
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
