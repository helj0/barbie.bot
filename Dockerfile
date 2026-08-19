FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The SQLite file is persisted via a Railway Volume mounted at /app/data
# (configured in the Railway dashboard, not here — Railway rejects the
# Docker VOLUME instruction).
ENV DATABASE_PATH=/app/data/bot.sqlite

CMD ["node", "src/index.js"]
