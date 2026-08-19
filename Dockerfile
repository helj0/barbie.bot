FROM node:22-slim

WORKDIR /app

# better-sqlite3 has no prebuilt binary for Node 22 on this platform yet,
# so it needs to compile from source - that requires a C++ toolchain.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The SQLite file is persisted via a Railway Volume mounted at /app/data
# (configured in the Railway dashboard, not here — Railway rejects the
# Docker VOLUME instruction).
ENV DATABASE_PATH=/app/data/bot.sqlite

CMD ["node", "src/index.js"]
