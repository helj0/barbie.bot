FROM node:20-slim

WORKDIR /app

# better-sqlite3's downloaded prebuilt binary was crashing at runtime on
# Railway (silent segfault on require, uncatchable in JS) - forcing a
# from-source build against this exact container fixes that, at the cost
# of needing a C++ toolchain during the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
ENV npm_config_build_from_source=true
RUN npm ci --omit=dev

COPY . .

# The SQLite file is persisted via a Railway Volume mounted at /app/data
# (configured in the Railway dashboard, not here — Railway rejects the
# Docker VOLUME instruction).
ENV DATABASE_PATH=/app/data/bot.sqlite

CMD ["node", "src/index.js"]
