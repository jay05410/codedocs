# CodeDocs

AI 기반 코드 문서 자동 생성기. 코드베이스를 분석하고, 아름다운 문서를 생성하며, 정적 사이트로 배포합니다.

## 왜 CodeDocs인가?

| 기능 | CodeDocs | DeepWiki | CodeWiki | DeepWiki-Open |
|------|----------|----------|----------|---------------|
| 셀프 호스팅 | O | X | X | O |
| 프라이빗 레포 | O | 위험* | X | O |
| 커스텀 파서 | 플러그인 시스템 | X | X | X |
| 멀티 LLM | OpenAI, Claude, Gemini, GLM, Ollama, Codex CLI, Gemini CLI | 고정 | 고정 | 고정 |
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
# -> http://localhost:3000
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
/** @type {import('@codedocs/core').CodeDocsConfig} */
export default {
  // 분석할 소스 코드 경로
  source: './src',

  // 파서 (문자열 이름으로 지정 - 런타임에 자동 해석)
  parsers: ['react', 'nestjs'],

  // AI 프로바이더 설정
  ai: {
    provider: 'openai',        // openai | claude | gemini | glm | ollama | custom | codex-cli | gemini-cli
    model: 'gpt-5.2',
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 60000,            // 선택: 요청 타임아웃(ms)
    maxRetries: 1,             // 선택: 일시적 오류 재시도 횟수
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
};
```

## CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `codedocs init` | 대화형 프로젝트 설정 (자동 스택 감지) |
| `codedocs analyze` | 소스 코드 분석 및 구조 추출 |
| `codedocs generate` | 분석 결과로 마크다운 문서 생성 |
| `codedocs build` | 전체 파이프라인: 분석 + 생성 + 정적 사이트 빌드 |
| `codedocs serve` | 문서 로컬 미리보기 |
| `codedocs dev` | 워치 모드 (자동 재분석 + 라이브 프리뷰) |
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

| 파서 | 이름 | 기술 스택 | 패키지 |
|------|------|-----------|--------|
| React | `react` | 컴포넌트, 훅, Next.js 라우트 | `@codedocs/parser-react` |
| Vue | `vue` | 컴포넌트, 컴포저블, Nuxt 라우트 | `@codedocs/parser-vue` |
| Svelte | `svelte` | 컴포넌트, 스토어, SvelteKit 라우트 | `@codedocs/parser-svelte` |
| NestJS | `nestjs` | REST, GraphQL, TypeORM, Prisma | `@codedocs/parser-typescript-nestjs` |
| Kotlin Spring Boot | `kotlin-spring` | REST, DGS GraphQL, JPA | `@codedocs/parser-kotlin-spring` |
| Java Spring Boot | `java-spring` | REST, JPA, Hibernate | `@codedocs/parser-java-spring` |
| Python FastAPI | `python-fastapi` | REST, SQLAlchemy, Pydantic | `@codedocs/parser-python-fastapi` |
| PHP | `php` | Laravel, Symfony, Eloquent, Doctrine | `@codedocs/parser-php` |
| Go | `go` | Gin, Echo, Fiber, Chi, GORM | `@codedocs/parser-go` |
| C | `c` | 구조체, 함수, 열거형, 매크로 | `@codedocs/parser-c` |
| C++ | `cpp` | 클래스, 템플릿, 네임스페이스 | `@codedocs/parser-cpp` |
| GraphQL | `graphql` | 스키마 기반 GraphQL | `@codedocs/parser-graphql` |
| OpenAPI / Swagger | `openapi` | 모든 스택 (스펙 임포트) | `@codedocs/parser-openapi` |

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

### CLI 기반 프로바이더 (API 키 불필요)

Codex CLI 또는 Gemini CLI를 AI 백엔드로 사용할 수 있습니다. OAuth 인증을 자체적으로 처리하므로 API 키가 필요 없습니다:

```typescript
ai: {
  provider: 'codex-cli',    // 또는 'gemini-cli'
  model: 'gpt-4.1',
}
```

CLI 도구 설치 및 인증이 필요합니다:
```bash
npm install -g @openai/codex   # 이후: codex auth login
npm install -g @google/gemini-cli  # 이후: gemini auth login
```

### Tree-sitter AST 파싱

정규식 기반 파서보다 높은 정확도를 위한 선택적 AST 기반 파싱 엔진입니다. [Tree-sitter](https://tree-sitter.github.io/) WASM을 사용하며 13개 언어를 지원합니다: TypeScript, TSX, JavaScript, JSX, Python, Go, Java, Kotlin, PHP, C, C++, HTML, CSS.

```bash
# 선택적 의존성 설치
npm install web-tree-sitter tree-sitter-typescript  # 필요한 문법 추가
```

Tree-sitter가 설치되지 않은 경우 기존 정규식 파서로 자동 폴백됩니다.

### AI 강화 문서

`generate` 단계에서 AI를 활용하여 문서 품질을 높입니다:

| Feature Flag | 기능 | 토큰 비용 |
|---|---|---|
| `domainGrouping` | 엔드포인트/엔티티를 비즈니스 도메인별로 사이드바 그룹핑 | ~800 토큰 |
| `flowDiagrams` | Mermaid 아키텍처 플로우 다이어그램 생성 | ~500 토큰 |
| `codeExplanation` | API 엔드포인트별 요청/응답 예시 생성 | ~500/엔드포인트 |

- 프롬프트는 영어로 전송하여 토큰 절약 (~20-30%)
- 응답은 `docs.locale` 설정 언어로 반환
- 3단계 폴백: AI → 휴리스틱 그룹핑 → 정적 사이드바
- 총 예산: ~9,000 토큰/실행 (그룹핑 1회 + 예시 15개 + 다이어그램 1회)

기타 기능:
- 워치 모드 + 라이브 프리뷰
- Marked 기반 정적 HTML 빌드
- Mermaid 다이어그램 복사/확대 인터랙션
- 계층형 접이식 사이드바

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

생성되는 문서의 모든 콘텐츠(섹션 제목, 테이블 레이블, 페이지 타이틀)가 `locale` 설정에 따라 번역됩니다:
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
| 정적 빌드 | Vite + unified (remark/rehype) |
| 마크다운 | unified (remark + rehype) |
| 코드 하이라이팅 | Shiki |
| 검색 | Pagefind |
| 다이어그램 | Mermaid.js |
| UI | React |
| CLI | Commander.js + Inquirer.js |
| 코드 파싱 | Tree-sitter WASM (선택적) |
| 테스트 | Vitest |

## 라이선스

MIT
