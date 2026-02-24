FROM node:20-alpine AS build

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY ../shared ./shared
COPY frontend ./frontend

RUN corepack enable pnpm && pnpm install --filter @ai-guitar-composer/frontend... --filter @ai-guitar-composer/shared...

WORKDIR /app/frontend
RUN pnpm build

FROM nginx:alpine

COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

