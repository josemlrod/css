FROM oven/bun:1-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS production-dependencies-env
COPY ./package.json bun.lock /app/
WORKDIR /app
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS build-env
ARG VITE_CONVEX_URL
ARG VITE_PAYPAL_CLIENT_ID
ARG VITE_PAYPAL_ENV
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL
ENV VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID
ENV VITE_PAYPAL_ENV=$VITE_PAYPAL_ENV
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN bun run build

FROM node:20-alpine
COPY ./package.json bun.lock /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["node", "./node_modules/.bin/react-router-serve", "./build/server/index.js"]
