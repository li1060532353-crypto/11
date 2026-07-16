FROM node:24-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @namdw/shared build && pnpm --filter @namdw/api build

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy --schema prisma/schema.prisma && pnpm run prisma:seed && node dist/main.js"]
