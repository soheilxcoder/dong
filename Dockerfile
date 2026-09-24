# ---- Dong self-hosted server: web app + API + SQLite in ONE image ----
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:selfhost

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=4000 DATABASE_FILE=/data/dong.db UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY --from=build /src/apps/api/dist ./apps/api/dist
COPY --from=build /src/apps/api/web ./apps/api/web
COPY --from=build /src/apps/api/package.json ./apps/api/package.json
COPY --from=build /src/package.json ./package.json
# runtime deps only (express, jsonwebtoken, multer, zod, qrcode, web-push, dotenv…)
COPY --from=build /src/node_modules ./node_modules
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "--no-warnings", "apps/api/dist/server.js"]
