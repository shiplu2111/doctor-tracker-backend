# Multi-stage Dockerfile for Doctor Tracker Backend API
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and shared package
COPY package*.json ./
COPY packages/shared ./packages/shared

# Install dependencies
RUN npm install

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build shared library and server
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy shared package and install production dependencies
COPY packages/shared ./packages/shared
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts || npm install --omit=dev

# Copy compiled outputs
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
