# Sandcastle agent image for redial.
#
# Build:
#   npm run sandcastle:build-image
#   # equivalent to: npx @ai-hero/sandcastle docker build-image
#
# Runtime:
#   sandcastle bind-mounts a worktree of this repo at /home/agent/workspace
#   and invokes the agent inside the container. The image keeps the host
#   workspace untouched until merge.

FROM node:22-bookworm

ARG AGENT_UID=1000
ARG AGENT_GID=1000

# System tooling the agent commonly reaches for.
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      jq \
      ca-certificates \
      gnupg \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI (apt repo).
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Align the base `node` user to the caller's UID/GID so files written into
# the bind-mounted workspace come out owned by the host user.
RUN groupmod -g "${AGENT_GID}" node \
    && usermod -u "${AGENT_UID}" -l agent -d /home/agent -m node \
    && groupmod -n agent node

USER agent
WORKDIR /home/agent

# Claude Code CLI — provides `claude` on PATH.
RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:${PATH}"

# Sandcastle bind-mounts the worktree here at runtime.
WORKDIR /home/agent/workspace

ENTRYPOINT ["sleep", "infinity"]
