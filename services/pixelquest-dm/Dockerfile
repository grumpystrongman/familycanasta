FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server.mjs ./server.mjs
EXPOSE 8787
CMD ["node", "server.mjs"]
