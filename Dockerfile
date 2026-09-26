FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV HOST=0.0.0.0
ENV PORT=8790
EXPOSE 8790
CMD ["npx", "tsx", "server/index.ts"]
