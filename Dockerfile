# syntax=docker/dockerfile:1.7

# ---- build stage ----
FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ARG GEMINI_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV GEMINI_API_KEY=$GEMINI_API_KEY
COPY package*.json ./
# Survive flaky/contended registry connectivity on the build host (the VPS is
# shared, so npm fetches can ECONNRESET under concurrent builds).
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=180000 \
    npm_config_fetch_timeout=600000
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: nginx static ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
