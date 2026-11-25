FROM node:22-slim
WORKDIR /app/server
ENV NODE_ENV=production PORT=7777
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
WORKDIR /app
COPY server ./server
COPY src/rules.js ./src/rules.js
EXPOSE 7777/tcp
USER node
CMD ["node", "server/main.js"]
