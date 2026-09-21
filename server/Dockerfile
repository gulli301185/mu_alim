FROM node:22-alpine AS builder

WORKDIR /app

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
COPY --from=builder /app/server/uploads ./uploads

EXPOSE 3001

CMD ["node", "dist/main.js"]
