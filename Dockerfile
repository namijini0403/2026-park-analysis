# park-analysis-web (Railway). Node app + Python runtime for the update-center
# checks/rebuilds (libraries, school zones, school disclosures), chat/office
# attachment parsing and the startup observed-policy-cards step.
# The code calls `python` (python_worker, observed_cards, rebuild commands) and
# `python3` (api/chat-upload on Linux); the venv provides both names.
FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONIOENCODING=utf-8 \
    PYTHONDONTWRITEBYTECODE=1

COPY package.json package-lock.json ./
COPY ui-preview/package.json ui-preview/package-lock.json ./ui-preview/
RUN npm ci && npm --prefix ui-preview ci --include=dev

COPY . .
# vercel_public/ is gitignored, so it is built here (same steps as the former
# Railpack buildCommand). ui-preview/dist is committed and served as-is.
RUN npm run build:vercel \
 && npm prune --omit=dev \
 && rm -rf ui-preview/node_modules

ENV NODE_ENV=production
CMD ["node", "server.js"]
