# Boss AI Container - Ubuntu 22.04 LTS with Claude Code CLI
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20
ENV PYTHON_VERSION=3.11

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    vim \
    nano \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/cli/install.sh | bash

# Create application directory
WORKDIR /app

# Create workspace directories
RUN mkdir -p /workspace/boss /workspace/shared-git

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code
COPY src/ ./src/
COPY tsconfig.json ./

# Install TypeScript globally
RUN npm install -g typescript ts-node

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create non-root user for security
RUN useradd -m -s /bin/bash claude-boss \
    && chown -R claude-boss:claude-boss /app /workspace

# Switch to non-root user
USER claude-boss

# Set up Claude Code CLI configuration
RUN mkdir -p /home/claude-boss/.config/claude
COPY --chown=claude-boss:claude-boss claude-config.json /home/claude-boss/.config/claude/config.json

# Expose port for health checks and API
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the Boss AI controller
CMD ["npm", "start"]