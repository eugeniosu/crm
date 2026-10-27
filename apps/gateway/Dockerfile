FROM oven/bun:1.4.4-slim AS build

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts --filter gateway
WORKDIR /app/apps/gateway
RUN bunx prisma generate

FROM oven/bun:1.4.4-slim

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/env ./packages/env
COPY --from=build /app/packages/auth ./packages/auth
COPY --from=build /app/apps/gateway ./apps/gateway

WORKDIR /app/apps/gateway
ENV NODE_ENV=production
ENV GATEWAY_PORT=3100
EXPOSE 3100
USER bun

CMD ["sh", "-c", "bunx prisma migrate deploy && exec bun src/main.ts"]
