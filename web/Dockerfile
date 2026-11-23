# App web de Vision Wize (Next.js). Por defecto llama a la API a través de su
# propio puente `/api/v1` (variable API_HOSTPORT al arrancar). Para llamar a la
# API directamente, fije su dirección al construir:
#   docker build --build-arg NEXT_PUBLIC_API_URL=https://api.ejemplo.com/v1 .
FROM node:24-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
