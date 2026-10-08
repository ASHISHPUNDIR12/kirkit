# Build from the backend directory: docker build -t kirkit-backend .
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src
# Generation requires a syntactically valid URL, but does not connect to a DB.
RUN DATABASE_URL=postgresql://build:build@localhost/build npm run build

# Separate release image: run migrations once before rolling out app replicas.
FROM build AS migrate
USER node
CMD ["npm", "run", "prisma:deploy"]

FROM build AS production-dependencies
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/live',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
