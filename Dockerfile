# Corollary: one process serves the landing page, the app, and the API.
FROM node:22-slim AS build
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci
COPY . .
RUN cd web && npm run build

FROM node:22-slim
WORKDIR /srv
ENV NODE_ENV=production
COPY --from=build /srv/package.json /srv/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /srv/src ./src
COPY --from=build /srv/server ./server
COPY --from=build /srv/tsconfig.json ./
COPY --from=build /srv/web/public ./web/public
COPY --from=build /srv/web/dist ./web/dist
# The research corpus ships in the image; runs land on the mounted volume.
COPY --from=build /srv/data/corpus ./data/corpus
# Demo runs are baked in as a seed; the server copies them into the (empty)
# runs volume on first boot so the app is browsable before any live run.
COPY --from=build /srv/data/runs ./data/seed-runs
VOLUME ["/srv/data/runs"]
EXPOSE 8787
CMD ["npx", "tsx", "server/api.ts"]
