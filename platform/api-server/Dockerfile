FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/index.js"]
