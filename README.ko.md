# CodeDocs

AI 기반 코드 문서 자동 생성기. 코드베이스를 분석하고, 아름다운 문서를 생성하며, 정적 사이트로 배포합니다.

## 왜 CodeDocs인가?

| 기능 | CodeDocs | DeepWiki | CodeWiki | DeepWiki-Open |
|------|----------|----------|----------|---------------|
| 셀프 호스팅 | O | X | X | O |
| 프라이빗 레포 | O | 위험* | X | O |
| 커스텀 파서 | 플러그인 시스템 | X | X | X |
| 멀티 LLM | OpenAI, Claude, Gemini, Ollama | 고정 | 고정 | 고정 |
| 에어갭 환경 | O (Ollama) | X | X | X |
| 다국어 | 한/영/일/중 | 영어 | 영어 | 영어 |
| 정적 사이트 출력 | O | X | X | X |

\* 코드가 모델 학습에 사용될 수 있음

## 빠른 시작

```bash
# 1. 초기화 (대화형 마법사 + 자동 감지)
npx codedocs init

# 2. 분석 + 생성 + 빌드 (올인원)
npx codedocs build

# 3. 로컬 미리보기
npx codedocs serve
# -> http://localhost:4321
```

## 설치

```bash
npm install codedocs
```

또는 개별 패키지 설치:

```bash
npm install @codedocs/core @codedocs/cli @codedocs/theme @codedocs/vite-plugin
```

### 요구사항

- Node.js >= 20
- npm >= 10

## 설정

`codedocs.config.ts`로 설정합니다:

```typescript
import { defineConfig } from '@codedocs/core';
import { nestjsParser } from '@codedocs/parser-typescript-nestjs';

export default defineConfig({
  // 분석할 소스 코드 경로
  source: './src',

  // 파서 (자동 감지 또는 수동 선택)
  parsers: [
    nestjsParser({ detectOrm: true }),
  ],

  // AI 프로바이더 설정
  ai: {
    provider: 'openai',        // openai | claude | gemini | glm | ollama
    model: 'gpt-4-turbo',
    apiKey: process.env.OPENAI_API_KEY,
    features: {
      domainGrouping: true,    // 도메인별 엔드포인트 그룹핑
      flowDiagrams: true,      // Mermaid 다이어그램 생성
      codeExplanation: true,   // 코드 설명 생성
    },
  },

  // 문서 구조
  docs: {
    title: '내 프로젝트',
    locale: 'ko',              // ko | en | ja | zh
    sections: [
      { id: 'overview', label: '개요', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: '데이터 모델', type: 'entities' },
      { id: 'architecture', label: '아키텍처', type: 'architecture' },
      { id: 'changelog', label: '변경 이력', type: 'changelog' },
    ],
  },

  // 테마 커스터마이징
  theme: {
    preset: 'default',         // default | swagger | redoc | mintlify
    colors: { primary: '#2e8555' },
  },
});
```

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `codedocs init` | 대화형 프로젝트 설정 (자동 스택 감지) |
| `codedocs analyze` | 소스 코드 분석 및 구조 추출 |
| `codedocs generate` | 분석 결과로 마크다운 문서 생성 |
| `codedocs build` | 전체 파이프라인: 분석 + 생성 + Vite SSG 빌드 |
| `codedocs serve` | 문서 로컬 미리보기 |
| `codedocs dev` | 워치 모드 (자동 재분석 + HMR) |
| `codedocs changelog` | 변경 이력 생성 및 버전 비교 |

### 옵션

```bash
codedocs init --detect          # 자동 감지 후 프롬프트 건너뛰기
codedocs init --yes             # 모든 기본값 사용
codedocs init --ci              # CI 설정만 생성 (GitHub Actions, GitLab CI, Jenkins)
codedocs analyze --verbose      # 상세 분석 정보 표시
codedocs build --skip-analyze   # 분석 단계 건너뛰기
codedocs dev --port 3000        # 커스텀 포트 지정
```

## 내장 파서

| 파서 | 기술 스택 | 패키지 |
|------|-----------|--------|
| Kotlin + Spring Boot | REST, DGS GraphQL, JPA | `@codedocs/parser-kotlin-spring` |
| Java + Spring Boot | REST, JPA, Hibernate | `@codedocs/parser-java-spring` |
| TypeScript + NestJS | REST, TypeORM, Prisma | `@codedocs/parser-typescript-nestjs` |
| Python + FastAPI | REST, SQLAlchemy, Pydantic | `@codedocs/parser-python-fastapi` |
| PHP + Laravel/Symfony | Laravel, Symfony, Eloquent, Doctrine | `@codedocs/parser-php` |
| OpenAPI / Swagger | 모든 스택 (스펙 임포트) | `@codedocs/parser-openapi` |
| Go | Gin, Echo, Fiber, Chi, GORM | `@codedocs/parser-go` |
| C | 구조체, 함수, 열거형, 매크로, microhttpd | `@codedocs/parser-c` |
| C++ | 클래스, 템플릿, 네임스페이스, Crow, Pistache, Qt | `@codedocs/parser-cpp` |
| GraphQL SDL | 스키마 기반 GraphQL | `@codedocs/parser-graphql` |
| React / Next.js | 컴포넌트, 라우트, 훅 | `@codedocs/parser-react` |
| Vue / Nuxt | 컴포넌트, 라우트, 컴포저블 | `@codedocs/parser-vue` |
| Svelte / SvelteKit | 컴포넌트, 라우트, 스토어 | `@codedocs/parser-svelte` |

## 커스텀 파서

플러그인으로 나만의 파서를 만들 수 있습니다:

```typescript
import { defineConfig } from '@codedocs/core';

export default defineConfig({
  source: './src',
  parsers: [{
    name: 'my-django-parser',
    filePattern: '**/*.py',
    parse(files) {
      // 커스텀 파싱 로직
      return {
        endpoints: [/* ... */],
        entities: [/* ... */],
      };
    },
  }],
});
```

## 주요 기능

### 자동 스택 감지

`codedocs init` 실행 시 프로젝트의 기술 스택을 자동으로 감지합니다:
- `package.json`, `build.gradle`, `pom.xml`, `go.mod`, `requirements.txt` 등을 스캔
- 감지된 프레임워크에 맞는 파서를 자동 추천

### AI 강화 문서

- 관련 엔드포인트의 도메인별 그룹핑
- Mermaid 다이어그램 (ER, 시퀀스, 플로우, 클래스, 상태, 컴포넌트, 배포)
- 코드 설명 및 비즈니스 로직 문서화
- 요청/응답 예시 자동 생성
- Pagefind 기반 전문 검색
- Shiki 코드 하이라이팅 (라이트/다크 듀얼 테마)
- 증분 빌드 캐싱으로 빠른 재빌드
- 워치 모드 + HMR (Hot Module Replacement)

### 테마 프리셋

내장 프리셋 또는 완전한 커스터마이징:

| 프리셋 | 스타일 |
|--------|--------|
| `default` | 깔끔하고 모던한 문서 |
| `swagger` | Swagger UI 스타일 API 문서 |
| `redoc` | ReDoc 스타일 3패널 레이아웃 |
| `mintlify` | Mintlify 스타일 디자인 |

### API 플레이그라운드

문서에서 직접 API를 테스트할 수 있는 인터랙티브 도구 (Postman 스타일).

### 버전 비교

버전 간 브레이킹 체인지를 자동으로 감지하고 추적합니다.

### 다국어 지원

문서 UI와 생성된 콘텐츠를 다음 언어로 제공합니다:
- 한국어 (`ko`)
- 영어 (`en`)
- 일본어 (`ja`)
- 중국어 (`zh`)

## 배포

CodeDocs는 어디서든 배포할 수 있는 정적 사이트를 생성합니다. `codedocs init --ci`로 GitHub Actions, GitLab CI, Jenkins용 CI/CD 설정을 자동 생성할 수 있습니다. 자세한 배포 가이드는 `docs/deploy-guide.md`를 참고하세요.

### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy CodeDocs
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx codedocs build
      - uses: actions/upload-pages-artifact@v2
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    steps:
      - uses: actions/deploy-pages@v3
```

### Nginx

```bash
npx codedocs build
# ./dist를 웹 서버에 복사
cp -r ./dist /var/www/codedocs
```

## 프로젝트 구조

```
codedocs/
├── packages/
│   ├── core/           # @codedocs/core - 엔진 (파서, AI, 생성기)
│   ├── cli/            # @codedocs/cli - CLI 도구
│   ├── theme/          # @codedocs/theme - React UI 테마
│   ├── vite-plugin/    # @codedocs/vite-plugin - Vite SSG 플러그인
│   └── parsers/        # 내장 파서 패키지
│       ├── kotlin-spring/
│       ├── java-spring/
│       ├── typescript-nestjs/
│       ├── python-fastapi/
│       ├── php/
│       ├── openapi/
│       ├── go/
│       ├── c/
│       ├── cpp/
│       ├── graphql/
│       ├── react/
│       ├── vue/
│       └── svelte/
├── templates/          # CI/CD 및 프로젝트 설정 템플릿
├── docs/               # 문서 및 가이드
├── .github/workflows/  # CI/CD
├── turbo.json          # Turborepo 설정
└── tsconfig.base.json  # 공유 TypeScript 설정
```

## 개발

```bash
# 의존성 설치
npm install

# 전체 패키지 빌드
npx turbo run build

# 테스트 실행
npx vitest run

# 타입 체크
npx turbo run typecheck

# 워치 모드
npx turbo run dev
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모노레포 | Turborepo + npm 워크스페이스 |
| 언어 | TypeScript (strict) |
| SSG | Vite |
| 마크다운 | unified (remark + rehype) |
| 코드 하이라이팅 | Shiki |
| 검색 | Pagefind |
| 다이어그램 | Mermaid.js |
| UI | React |
| CLI | Commander.js + Inquirer.js |
| 테스트 | Vitest |

## 라이선스

MIT
