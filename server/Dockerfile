FROM node:22-alpine AS builder

WORKDIR /app

COPY prisma ./prisma
COPY server ./server

WORKDIR /app/server
RUN npm ci
RUN npm run build

FROM node:22-alpine

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/src/openapi.json ./src/openapi.json
COPY --from=builder /app/server/uploads ./uploads
COPY --from=builder /app/prisma ./../prisma

EXPOSE 3001

CMD ["node", "dist/index.js"]
