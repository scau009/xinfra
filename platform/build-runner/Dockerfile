FROM node:20-alpine
RUN apk add --no-cache docker-cli git
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY src/ ./src/
CMD ["node", "src/index.js"]
