FROM node:22

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source
COPY src/ src/
COPY tsconfig.json ./

# Create a non-root user — the Agent SDK refuses to run
# --dangerously-skip-permissions as root for security reasons
RUN useradd -m -s /bin/bash appuser && \
    chown -R appuser:appuser /app && \
    mkdir -p /home/appuser/.claude && \
    chown -R appuser:appuser /home/appuser/.claude

USER appuser

# The server runs via tsx (handles TypeScript directly)
# Port is set via PORT env var (Fly injects this)
EXPOSE 8080

CMD ["npx", "tsx", "src/server.ts"]
