FROM node:20-alpine AS builder
WORKDIR /app
COPY ../package.json ./
RUN npm i
COPY .. .
RUN npm run build


FROM node:20-alpine AS production

# Install tini for proper signal handling
RUN apk add --no-cache tini
WORKDIR /app
COPY ../package*.json ./
RUN npm i --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./
ENV NODE_ENV production
ENV PORT 3000
EXPOSE 3000

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app/.next
USER nextjs

# Use tini as init process
ENTRYPOINT [ "/sbin/tini", "--" ]
CMD ["npm", "start"]