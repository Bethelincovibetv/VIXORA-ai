# Multi-stage Dockerfile for Vixora Video Creation Engine (Node.js + FFmpeg)
FROM node:22-bullseye-slim

# Install system dependencies including FFmpeg, fonts for ASS subtitles, and CA certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    ca-certificates \
    curl \
 && fc-cache -f \
 && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code and config
COPY . .

# Build Vite frontend bundle and compile server.ts via esbuild to dist/server.cjs
RUN npm run build

# Remove development dependencies to keep image lean
RUN npm prune --production

# Create persistent storage folder for temp renders and asset downloads
RUN mkdir -p /tmp/vixora_assets && chmod 777 /tmp/vixora_assets

# Environment setup
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start compiled server
CMD ["npm", "start"]
