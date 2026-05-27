# 1단계: 의존성 설치 (Dependencies)
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
# PM2 전역 설치
RUN npm install -g pm2

# 2단계: 실행 환경 (Runner)
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV PORT 3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# PM2 전역 설치 (runner 단계에서 직접 수행)
RUN npm install -g pm2

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./
COPY ecosystem.config.js ./
COPY public ./public

# 로그 디렉토리 생성 및 권한 설정
RUN mkdir logs && chown nodejs:nodejs logs

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# PM2 Runtime으로 실행 (ecosystem.config.js 사용)
CMD ["pm2-runtime", "ecosystem.config.js", "--env", "production"]
