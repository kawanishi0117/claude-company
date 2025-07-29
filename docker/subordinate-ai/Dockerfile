# Subordinate AI Container - Ubuntu 22.04 LTS with Claude Code CLI
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
    golang-go \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/cli/install.sh | bash

# Install additional development tools
RUN npm install -g typescript ts-node jest eslint prettier

# Create application directory
WORKDIR /app

# Create workspace directories
RUN mkdir -p /workspace/sub /workspace/shared-git

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create non-root user for security
RUN useradd -m -s /bin/bash claude-sub \
    && chown -R claude-sub:claude-sub /app /workspace

# Switch to non-root user
USER claude-sub

# Set up Claude Code CLI configuration
RUN mkdir -p /home/claude-sub/.config/claude
COPY --chown=claude-sub:claude-sub docker/subordinate-ai/claude-config.json /home/claude-sub/.config/claude/config.json

# Expose port for health checks
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Start the Subordinate AI controller
CMD ["npm", "start"]