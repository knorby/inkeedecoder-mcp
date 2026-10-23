# Builds the MCP server for container-based distribution (Smithery, Glama).
# Multi-stage: the final image carries only the built output and production
# dependencies. The server runs over stdio.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
# UID 1000 is the image's `node` user; numeric per hadolint DL3066.
USER 1000:1000
ENTRYPOINT ["node", "dist/index.js"]
