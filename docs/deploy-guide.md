# CodeDocs 배포 가이드 / Deployment Guide

This guide covers all major deployment options for CodeDocs-generated documentation sites.

## 목차 / Table of Contents

1. [GitHub Pages](#github-pages)
2. [GitLab Pages](#gitlab-pages)
3. [Netlify](#netlify)
4. [Vercel](#vercel)
5. [Nginx](#nginx)
6. [Docker](#docker)

---

## GitHub Pages

### 수동 설정 / Manual Setup

1. GitHub 저장소의 Settings → Pages로 이동
2. Source를 "GitHub Actions"로 설정
3. 아래 워크플로우 파일 생성

### 자동 생성 / Automatic Generation

```bash
codedocs init --ci
```

또는 CI 설정만 생성하려면:

```bash
codedocs init --ci
```

생성된 파일: `.github/workflows/deploy.yml`

### 사용자 정의 도메인 / Custom Domain

1. 저장소 설정에서 Custom domain 추가
2. DNS 제공업체에서 CNAME 레코드 추가:
   ```
   www.yourdomain.com → your-username.github.io
   ```
3. `codedocs.config.ts`에서 base 경로 수정:
   ```typescript
   build: {
     base: '/',  // 커스텀 도메인 사용 시
   }
   ```

### 비밀키 설정 / Secrets Configuration

Settings → Secrets and variables → Actions에서 AI API 키 추가:

- OpenAI: `OPENAI_API_KEY`
- Anthropic Claude: `ANTHROPIC_API_KEY`
- Google Gemini: `GOOGLE_API_KEY`

---

## GitLab Pages

### 설정 / Setup

`.gitlab-ci.yml` 파일을 프로젝트 루트에 생성:

```yaml
image: node:20

pages:
  stage: deploy
  cache:
    paths:
      - node_modules/
  script:
    - npm ci
    - npx codedocs build
    - mv dist public
  artifacts:
    paths:
      - public
  only:
    - main
  variables:
    OPENAI_API_KEY: ${OPENAI_API_KEY}
```

### 환경 변수 / Environment Variables

Settings → CI/CD → Variables에서 추가:

- Key: `OPENAI_API_KEY` (또는 다른 AI 제공자)
- Value: 실제 API 키
- Flags: Masked 체크

### 사용자 정의 도메인 / Custom Domain

1. Settings → Pages → New Domain
2. DNS에서 A 레코드 또는 CNAME 추가
3. TLS/SSL 인증서 자동 발급

---

## Netlify

### 설정 파일 / Configuration

`netlify.toml` 파일 생성:

```toml
[build]
  command = "npx codedocs build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 배포 방법 / Deployment Methods

#### Git 연결 / Git Integration

1. Netlify 대시보드에서 "New site from Git" 클릭
2. 저장소 연결
3. Build command: `npx codedocs build`
4. Publish directory: `dist`

#### CLI 배포 / CLI Deployment

```bash
npm install -g netlify-cli
netlify init
netlify deploy --prod
```

### 환경 변수 / Environment Variables

Site settings → Build & deploy → Environment에서 추가:

```
OPENAI_API_KEY=sk-...
```

---

## Vercel

### 설정 파일 / Configuration

`vercel.json` 파일 생성:

```json
{
  "buildCommand": "npx codedocs build",
  "outputDirectory": "dist",
  "framework": null,
  "devCommand": "npx codedocs serve"
}
```

### 배포 방법 / Deployment Methods

#### CLI 배포 / CLI Deployment

```bash
npm install -g vercel
vercel
```

#### Git 연결 / Git Integration

1. Vercel 대시보드에서 "New Project" 클릭
2. 저장소 임포트
3. Framework Preset: Other
4. Build Command: `npx codedocs build`
5. Output Directory: `dist`

### 환경 변수 / Environment Variables

Project Settings → Environment Variables에서 추가:

```
OPENAI_API_KEY=sk-...
```

---

## Nginx

### 기본 설정 / Basic Configuration

`/etc/nginx/sites-available/codedocs` 파일:

```nginx
server {
    listen 80;
    server_name docs.yourdomain.com;
    root /var/www/codedocs/dist;
    index index.html;

    # Gzip 압축 / Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # 캐시 설정 / Cache Settings
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA 라우팅 / SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 보안 헤더 / Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### HTTPS 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d docs.yourdomain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

### 빌드 및 배포 스크립트 / Build & Deploy Script

```bash
#!/bin/bash
# deploy.sh

# 빌드
npm run build

# 배포 디렉토리로 복사
sudo rsync -avz --delete dist/ /var/www/codedocs/dist/

# Nginx 재시작
sudo systemctl reload nginx

echo "Deployment complete!"
```

---

## Docker

### Dockerfile

프로젝트 루트에 `Dockerfile` 생성:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx codedocs build

# Production stage
FROM nginx:alpine

# Nginx 설정 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 커스텀 Nginx 설정
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  codedocs:
    build: .
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    volumes:
      - ./dist:/usr/share/nginx/html:ro
```

### 빌드 및 실행 / Build & Run

```bash
# 이미지 빌드
docker build -t codedocs .

# 컨테이너 실행
docker run -d -p 8080:80 --name codedocs codedocs

# docker-compose 사용
docker-compose up -d
```

### 환경 변수 전달 / Passing Environment Variables

빌드 시 AI API 키가 필요한 경우:

```bash
docker build \
  --build-arg OPENAI_API_KEY=$OPENAI_API_KEY \
  -t codedocs .
```

Dockerfile에 추가:

```dockerfile
ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=$OPENAI_API_KEY
```

---

## 일반적인 문제 해결 / Troubleshooting

### 404 오류 (SPA 라우팅)

**증상**: 새로고침 시 404 오류

**해결책**: 서버 설정에서 모든 경로를 `index.html`로 리다이렉트

- Nginx: `try_files $uri $uri/ /index.html;`
- Netlify: `netlify.toml`에 리다이렉트 규칙 추가
- Vercel: 자동 처리됨

### 절대 경로 문제

**증상**: 에셋이 로드되지 않음 (GitHub Pages 하위 경로)

**해결책**: `codedocs.config.ts`에서 base 경로 설정

```typescript
build: {
  base: '/repository-name/',  // GitHub Pages 하위 경로
}
```

### AI API 호출 실패

**증상**: 빌드 중 API 에러

**해결책**:
1. 환경 변수가 올바르게 설정되었는지 확인
2. API 키 권한 및 크레딧 확인
3. CI/CD 비밀키가 올바르게 등록되었는지 확인

### 빌드 시간 초과

**증상**: CI/CD 빌드가 타임아웃

**해결책**:
1. 증분 빌드 활성화
2. 캐시 설정 활용
3. AI 기능 선택적으로 비활성화

```typescript
ai: {
  features: {
    domainGrouping: true,
    flowDiagrams: false,  // 대규모 프로젝트에서 비활성화
    codeExplanation: false,
  },
}
```

---

## 성능 최적화 / Performance Optimization

### CDN 사용

- **Cloudflare**: 무료 CDN + DDoS 보호
- **CloudFront**: AWS 통합 환경
- **Fastly**: 엔터프라이즈급 CDN

### 정적 자산 최적화

1. 이미지 압축 및 최적화
2. JavaScript/CSS 번들링 및 minification (자동)
3. Brotli/Gzip 압축 활성화

### 프리렌더링

대규모 문서의 경우 SSG(Static Site Generation) 활용:

```typescript
build: {
  prerender: true,  // 모든 페이지 사전 렌더링
}
```

---

## 보안 권장사항 / Security Best Practices

1. **API 키 관리**
   - 절대 코드에 하드코딩하지 않기
   - 환경 변수 또는 비밀 관리 서비스 사용

2. **HTTPS 강제**
   - 모든 프로덕션 환경에서 HTTPS 사용
   - HSTS 헤더 추가

3. **보안 헤더**
   ```nginx
   add_header X-Frame-Options "SAMEORIGIN";
   add_header X-Content-Type-Options "nosniff";
   add_header X-XSS-Protection "1; mode=block";
   add_header Referrer-Policy "strict-origin-when-cross-origin";
   ```

4. **접근 제어**
   - 내부 문서의 경우 IP 화이트리스트 또는 인증 설정

---

## 지원 및 문의 / Support

문제가 발생하면:
1. [GitHub Issues](https://github.com/jay05410/codedocs/issues)에 리포트
2. [문서](https://github.com/jay05410/codedocs) 참조
3. [GitHub Discussions](https://github.com/jay05410/codedocs/discussions) 참여
