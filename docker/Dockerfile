FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV npm_config_loglevel=info \
    npm_config_fund=false \
    npm_config_audit=false \
    npm_config_fetch_timeout=300000 \
    npm_config_fetch_retries=5

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates dumb-init tzdata \
  && ln -sf /usr/share/zoneinfo/America/Bogota /etc/localtime \
  && echo "America/Bogota" > /etc/timezone \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    TZ=America/Bogota

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start"]
