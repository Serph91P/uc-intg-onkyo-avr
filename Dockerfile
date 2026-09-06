# Keep aligned with .nvmrc; the digest pins the multi-platform image index.
ARG NODE_IMAGE=node:22.22.0-bookworm-slim@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    UC_CONFIG_HOME=/config \
    UC_INTEGRATION_INTERFACE=0.0.0.0 \
    UC_INTEGRATION_HTTP_PORT=9090
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json driver.json eiscp.png LICENSE ./
COPY logos ./logos
COPY docker/healthcheck.mjs ./docker/healthcheck.mjs
# Fail rather than shipping mismatched release metadata.
RUN node -e "const fs=require('fs');if(JSON.parse(fs.readFileSync('driver.json')).version!==JSON.parse(fs.readFileSync('package.json')).version)process.exit(1)" \
    && mkdir /config && chown node:node /config
USER node
VOLUME ["/config"]
EXPOSE 9090/tcp
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["node", "docker/healthcheck.mjs"]
CMD ["node", "dist/driver.js"]
