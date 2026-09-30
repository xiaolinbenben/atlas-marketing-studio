FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/app/data/atlas.db
RUN npx prisma generate && npm run build \
 && node -e 'const fs=require("fs"),path=require("path");const seen=new Set();const walk=name=>{if(!name||seen.has(name))return;const dir=path.join("node_modules",name);if(!fs.existsSync(path.join(dir,"package.json")))return;seen.add(name);for(const dep of Object.keys(JSON.parse(fs.readFileSync(path.join(dir,"package.json"),"utf8")).dependencies||{}))walk(dep)};walk("prisma");for(const name of seen){const dest=path.join("/migrate/node_modules",name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join("node_modules",name),dest,{recursive:true})}'

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl wget
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/app/data/atlas.db
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts/prepare-migrations.mjs ./scripts/prepare-migrations.mjs
COPY --from=builder --chown=nextjs:nodejs /migrate/node_modules/ ./node_modules/
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
