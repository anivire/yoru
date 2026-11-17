FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NX_DAEMON=false NX_NO_CLOUD=true
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ git && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN npm ci
COPY . .
RUN npx nx run-many -t build --projects=api,web
ARG GIT_COMMIT=
RUN node -p "require('./package.json').version" > VERSION \
    && (if [ -n "$GIT_COMMIT" ]; then echo "$GIT_COMMIT"; else git rev-parse HEAD 2>/dev/null || true; fi) > COMMIT

FROM node:22-bookworm-slim
WORKDIR /app
ARG RELEASE_CHANNEL=stable
ENV NODE_ENV=production \
    RELEASE_CHANNEL=$RELEASE_CHANNEL \
    PORT=3000 \
    DATA_DIR=/data \
    WEB_DIST=/app/web \
    MIGRATIONS_DIR=/app/drizzle
RUN echo '{"type":"module"}' > package.json
COPY --from=build /app/node_modules/better-sqlite3 node_modules/better-sqlite3
COPY --from=build /app/node_modules/bindings node_modules/bindings
COPY --from=build /app/node_modules/file-uri-to-path node_modules/file-uri-to-path
COPY --from=build /app/apps/api/dist dist
COPY --from=build /app/apps/api/drizzle drizzle
COPY --from=build /app/apps/web/dist web
COPY --from=build /app/VERSION /app/COMMIT ./
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
