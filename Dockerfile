FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./

RUN npm ci --only=production

FROM node:20-alpine

RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

WORKDIR /app

COPY --from=builder --chown=appuser:appgroup /build/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

RUN mkdir -p /app/data /app/data/task-logs && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3210

ENV NODE_ENV=production
ENV PORT=3210

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const http=require('http');http.get('http://127.0.0.1:3210/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1));"

CMD ["node", "server.js"]
