# Keeper image. Works on Fly.io, Railway, Render, Cloud Run, or plain Docker.
FROM node:20-alpine

WORKDIR /app

# Copy manifests first so dependency layers cache across code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY keeper.mjs ./

# Run unprivileged — the container holds a funded key.
USER node

# Watch mode: one long-lived process, not a cron that re-execs.
CMD ["node", "keeper.mjs", "--watch"]
