# API de Vision Wize (NestJS + Prisma). Al arrancar aplica las migraciones pendientes.
FROM node:24-slim AS build
WORKDIR /app
# `prisma generate` (postinstall) solo necesita que la variable exista.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json /app/prisma.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
# La semilla del dueño (`prisma db seed`) usa el cliente generado en TypeScript.
COPY --from=build /app/src/generated ./src/generated
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
