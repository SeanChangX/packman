FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install

FROM deps AS builder
COPY packages/shared ./packages/shared
RUN pnpm --filter @packman/shared build

COPY apps/admin ./apps/admin
RUN pnpm --filter admin build

FROM nginx:1.27-alpine AS runner
# apache2-utils provides htpasswd for generating basic auth credentials at runtime
RUN apk add --no-cache apache2-utils
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/admin/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
