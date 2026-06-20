FROM node:22-alpine AS admin-builder

WORKDIR /app/admin

COPY admin/package*.json ./
RUN npm install

COPY admin ./
RUN npm run build

FROM node:22-alpine

ARG IMAGE_STUDIO_VERSION=dev
LABEL org.opencontainers.image.title="Image Studio API"
LABEL org.opencontainers.image.description="Self-hosted private Image Studio API for AI tools"
LABEL org.opencontainers.image.version=$IMAGE_STUDIO_VERSION

WORKDIR /app

COPY shared ./shared
COPY server ./server
COPY --from=admin-builder /app/admin/dist ./admin/dist

WORKDIR /app/server

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV CONFIG_PATH=/data/config.json

EXPOSE 8787

CMD ["node", "src/index.js"]
