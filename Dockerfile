FROM oven/bun:1.4.4-slim AS bun

FROM node:24.11.1-slim

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

WORKDIR /app
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV CRM_TELEMETRY_DISABLED=1
RUN bun install --frozen-lockfile --ignore-scripts

ARG API_URL=http://crm-api:3001
ENV API_URL=${API_URL}
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build bun run db:generate \
	&& DATABASE_URL=postgresql://build:build@localhost:5432/build \
		BETTER_AUTH_SECRET=only-used-while-building-the-image \
		NODE_OPTIONS=--max-old-space-size=6144 \
		bunx turbo run build --concurrency=1

ENV NODE_ENV=production
USER node
