# Multi-stage Dockerfile for Doctor Tracker Backend API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package and build
COPY shared ./shared
RUN cd shared && npm ci && npm run build

# Copy server package and build
COPY server ./server
RUN cd server && npm ci && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy built shared library
COPY --from=builder /app/shared ./shared

# Install production dependencies for server
COPY --from=builder /app/server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy compiled JavaScript output
COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server
EXPOSE 4000

CMD ["node", "dist/server.js"]
