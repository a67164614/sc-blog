FROM node:24-alpine AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/publisher/package.json services/publisher/package.json
RUN corepack enable && pnpm install --frozen-lockfile --filter @sc-blog/publisher...
COPY services/publisher/tsconfig.json services/publisher/tsconfig.json
COPY services/publisher/src services/publisher/src
RUN pnpm --filter @sc-blog/publisher type-check
RUN pnpm --filter @sc-blog/publisher deploy --prod --legacy /publisher

FROM node:24-alpine
WORKDIR /app
COPY --from=build /publisher ./
COPY --from=build /app/services/publisher/src ./src
USER node
EXPOSE 8787
CMD ["node", "--import", "tsx/esm", "src/server.ts"]
