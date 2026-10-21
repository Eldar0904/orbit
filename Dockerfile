FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.15.1
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_PROXY_URL=/api/__clerk
ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/pm-app run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public
COPY --from=build --chown=node:node /app/artifacts/api-server/dist ./server
COPY --from=build --chown=node:node /app/artifacts/pm-app/dist/public ./public
USER node
CMD ["node", "--enable-source-maps", "server/index.mjs"]
