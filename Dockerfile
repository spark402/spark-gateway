FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm i
COPY . .
RUN npm run build
EXPOSE 8787
CMD ["node","dist/server.js"]
