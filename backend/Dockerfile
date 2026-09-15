FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

ENV PORT=3001
ENV DATA_DIR=/data
EXPOSE 3001

CMD ["node", "src/index.js"]
