FROM node:20-alpine
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk add --no-cache docker-cli
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm install --production
COPY src/ ./src/
CMD ["node", "src/index.js"]
