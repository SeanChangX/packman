FROM node:25-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/admin/package.json ./apps/admin/
RUN pnpm install

FROM deps AS builder
COPY packages/shared ./packages/shared
RUN pnpm --filter @packman/shared build
COPY packages/ui ./packages/ui
RUN pnpm --filter @packman/ui build

COPY apps/admin ./apps/admin
RUN pnpm --filter admin build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
