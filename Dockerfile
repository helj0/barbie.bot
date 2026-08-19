FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Persist the SQLite file outside the container image.
VOLUME ["/app/data"]
ENV DATABASE_PATH=/app/data/bot.sqlite

CMD ["node", "src/index.js"]
