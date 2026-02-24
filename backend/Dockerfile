FROM node:20-alpine AS build

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY shared ./shared
COPY backend ./backend

RUN corepack enable pnpm && pnpm install --filter @riffmaster/backend... --filter @riffmaster/shared...

WORKDIR /app/backend
RUN pnpm build

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/package.json ./package.json

EXPOSE 4000

CMD ["node", "dist/index.js"]

