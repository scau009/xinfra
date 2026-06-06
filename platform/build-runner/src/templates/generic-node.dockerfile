FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build 2>/dev/null || true
CMD ["npm", "start"]
EXPOSE 3000
