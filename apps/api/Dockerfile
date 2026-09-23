FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @dong/api --include-workspace-root
COPY packages/core packages/core
COPY apps/api apps/api
RUN npm run prisma:generate -w @dong/api && npm run build -w @dong/api
WORKDIR /app/apps/api
CMD npx prisma migrate deploy && node dist/apps/api/src/index.js
