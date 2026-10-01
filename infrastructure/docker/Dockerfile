FROM node:24.21.0-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ARG NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile && pnpm db:generate && pnpm build

FROM build AS api
USER node
ENV NODE_ENV=production API_HOST=0.0.0.0
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

FROM build AS web
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/web/node_modules/next/dist/bin/next", "start", "apps/web", "-H", "0.0.0.0", "-p", "3000"]

FROM build AS worker
USER node
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/main.js"]
