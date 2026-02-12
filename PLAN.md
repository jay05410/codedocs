# CodeDocs - AI 기반 코드 문서화 오픈소스 프로젝트 플랜

> **현재 프로젝트**: `imos-docs` (Kotlin/Spring Boot/DGS GraphQL 특화 내부 문서화 도구)
> **목표**: 언어/스택에 무관한 범용 AI 코드 문서화 오픈소스 도구로 전환
> **npm scope**: `@codedocs/*`
> **SSG**: 직접 구현 (Vite + Unified) — Docusaurus 미사용

---

## 1. 왜 이 프로젝트가 필요한가

### 기존 도구들의 한계

| 도구 | 문제점 |
|------|--------|
| **DeepWiki** (Cognition) | 프라이빗 레포 분석 시 코드가 모델 학습에 사용될 가능성 (개인정보 보호 정책에 명시), 영어 전용, 자체 호스팅 불가 |
| **CodeWiki** (Google) | 공개 레포만 지원 (프라이빗은 대기자 명단), 자체 호스팅/서브도메인 불가 |
| **DeepWiki-Open** | 자체 호스팅은 되지만, 커스텀 파서/사이드바/메뉴 구성 불가, 정적 사이트 생성 미지원 |
| **FSoft CodeWiki** | 7개 언어만 지원, 비즈니스 로직 분석 미흡, Jenkins 파이프라인 연동 어려움 |
| **codedoc.cc** | 4년 이상 미업데이트 (사실상 폐기), AI 미지원, 코드 분석 없음 |

### CodeDocs가 제공하는 차별점

1. **완전한 자체 호스팅**: Nginx, GitHub Pages, GitLab Pages, Jenkins 등으로 사내 서빙
2. **커스텀 파서**: 사용자가 자기 프로젝트의 파싱 로직을 직접 정의 (플러그인 시스템)
3. **멀티 LLM**: OpenAI, Claude, Gemini, GLM + **Ollama(로컬 LLM)** 지원
4. **언어/스택 무관**: Kotlin, Java, Python, Go, TypeScript, React, Vue 등 백엔드+프론트엔드 모두 지원
5. **파이프라인 친화적**: Jenkins, GitHub Actions, GitLab CI에서 브랜치 변경 감지 → 자동 문서 갱신
6. **한국어/영어 다국어 지원**
7. **보안**: 코드가 외부로 나가지 않음 (Ollama 사용 시 완전 에어갭 가능)
8. **페이지별 메타 태그 오버라이드**: codedoc.cc 벤치마킹 — 개별 페이지 제목/설명/태그 커스텀
9. **완전한 테마 커스터마이징**: CSS 변수 + 컴포넌트 플러그인으로 UI 자유 구성

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                     codedocs.config.ts                       │
│  (프로젝트 설정: 파서, AI, 사이드바, 테마, 배포 등)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Parser  │  │    AI    │  │   Docs   │
   │  Engine  │  │  Engine  │  │ Generator│
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │              │              │
   ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
   │ Built-in │  │ OpenAI   │  │Vite SSG  │
   │ Parsers  │  │ Claude   │  │+ Unified │
   │ + Custom │  │ Gemini   │  │(remark/  │
   │ Plugins  │  │ Ollama   │  │ rehype)  │
   │          │  │ Custom   │  │          │
   └──────────┘  └──────────┘  └──────────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              analysis-result.json
                       │
                       ▼
              ┌─────────────────┐
              │  Static Site    │
              │  Generation     │
              │ (Vite + React)  │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   GitHub Pages   Jenkins/Nginx   GitLab Pages
```

### 기술 스택 (직접 구현 SSG)

| 영역 | 기술 | 이유 |
|------|------|------|
| Monorepo | **Turborepo** + npm workspaces | 캐싱, 병렬 빌드, 의존성 관리 |
| 언어 | **TypeScript** (strict) | 타입 안전성, npm 생태계 |
| SSG 빌드 | **Vite** | 빠른 HMR, SSG 플러그인, 번들 최적화 |
| Markdown 처리 | **unified** (remark + rehype) | 표준 AST 기반 MD→HTML, 플러그인 확장 |
| 코드 하이라이팅 | **Shiki** | VS Code 급 문법 강조, 테마 지원 |
| 검색 | **Pagefind** | 빌드 타임 인덱싱, 제로 JS 번들 임팩트 |
| 다이어그램 | **Mermaid.js** | ER, Sequence, Flow 다이어그램 |
| UI 프레임워크 | **React** (standalone) | 컴포넌트 기반 테마 |
| CLI | **Commander.js** + **Inquirer.js** | 대화형 마법사 + 명령어 파싱 |
| 테스트 | **Vitest** | 빠른 실행, TypeScript 네이티브 |
| CI 템플릿 | **Handlebars** | 간단한 템플릿 엔진 |

---

## 3. 핵심 설계 원칙

### 3.1 설정 파일 하나로 모든 것을 제어 (`codedocs.config.ts`)

```typescript
// codedocs.config.ts 예시
import { defineConfig } from '@codedocs/core';
import { kotlinSpringParser } from '@codedocs/parser-kotlin-spring';

export default defineConfig({
  // 1. 분석할 소스 경로
  source: '../my-backend/src',

  // 2. 파서 선택 (빌트인 + 커스텀)
  parsers: [
    kotlinSpringParser({ detectFrameworks: true }),
    // 커스텀 파서도 인라인 가능
    {
      name: 'my-custom-parser',
      filePattern: '**/*.py',
      parse(files) {
        return { endpoints: [], entities: [] };
      },
    },
  ],

  // 3. AI 설정
  ai: {
    provider: 'ollama',
    model: 'llama3.1:70b',
    baseUrl: 'http://localhost:11434',
    features: {
      domainGrouping: true,
      flowDiagrams: true,
      codeExplanation: true,
      releaseNoteAnalysis: true,
    },
  },

  // 4. 문서 구조
  docs: {
    title: 'My Project Docs',
    logo: './assets/logo.png',
    locale: 'ko',
    sections: [
      { id: 'overview', label: '개요', type: 'auto' },
      { id: 'api', label: 'API', type: 'endpoints' },
      { id: 'entities', label: 'Data Models', type: 'entities' },
      { id: 'architecture', label: 'Architecture', type: 'architecture' },
      { id: 'changelog', label: 'Changelog', type: 'changelog' },
      { id: 'custom', label: 'Custom Docs', type: 'custom', dir: './my-docs' },
    ],
    // 페이지별 메타 태그 오버라이드 (codedoc.cc 벤치마킹)
    pageOverrides: {
      '/api/users': {
        title: 'User API Reference',
        description: 'Complete user management API documentation',
        tags: ['api', 'users', 'auth'],
      },
    },
  },

  // 5. 테마/UI
  theme: {
    preset: 'default',
    colors: { primary: '#2e8555' },
    // 컴포넌트 플러그인 (codedoc.cc 벤치마킹)
    components: {
      ApiCard: './my-components/CustomApiCard.tsx',
    },
    css: './my-styles/override.css',
  },

  // 6. Git 연동
  git: {
    trackBranch: 'develop',
    autoVersionBump: true,
  },
});
```

### 3.2 플러그인 기반 파서 시스템

```typescript
// @codedocs/core - 파서 인터페이스
interface ParserPlugin {
  name: string;
  filePattern: string | string[];
  parse(files: SourceFile[]): ParseResult;
}

interface SourceFile {
  path: string;
  content: string;
  language: string;
}

interface ParseResult {
  endpoints?: EndpointInfo[];
  entities?: EntityInfo[];
  services?: ServiceInfo[];
  types?: TypeInfo[];
  dependencies?: DependencyInfo[];
  custom?: Record<string, any>;
}
```

### 3.3 빌트인 파서 목록 (점진적 확장)

| Phase | 파서 | 대상 |
|-------|------|------|
| **Phase 1** | `@codedocs/parser-kotlin-spring` | Kotlin + Spring Boot + JPA + DGS GraphQL |
| **Phase 2** | `@codedocs/parser-java-spring` | Java + Spring Boot + JPA + Hibernate |
| **Phase 2** | `@codedocs/parser-typescript-nestjs` | TypeScript + NestJS + TypeORM/Prisma |
| **Phase 2** | `@codedocs/parser-python-fastapi` | Python + FastAPI + SQLAlchemy |
| **Phase 2** | `@codedocs/parser-openapi` | OpenAPI/Swagger spec 직접 import |
| **Phase 3** | `@codedocs/parser-go` | Go + Gin/Echo/Fiber + GORM |
| **Phase 3** | `@codedocs/parser-graphql` | GraphQL schema 직접 import |
| **Phase 3** | `@codedocs/parser-react` | React + Next.js 컴포넌트/라우트/훅 분석 |
| **Phase 3** | `@codedocs/parser-vue` | Vue + Nuxt 컴포넌트/라우트 분석 |
| **Phase 3** | `@codedocs/parser-svelte` | Svelte + SvelteKit 분석 |

---

## 4. 프로젝트 구조 (멀티모듈 Monorepo)

```
codedocs/
├── packages/
│   ├── core/                          # @codedocs/core — 핵심 엔진
│   │   ├── src/
│   │   │   ├── config/                # 설정 로더
│   │   │   │   ├── schema.ts          # Zod 기반 설정 스키마
│   │   │   │   ├── loader.ts          # codedocs.config.ts 로드
│   │   │   │   └── defaults.ts        # 기본값
│   │   │   ├── parser/                # 파서 엔진
│   │   │   │   ├── types.ts           # ParserPlugin, ParseResult 인터페이스
│   │   │   │   ├── engine.ts          # 파서 실행 엔진
│   │   │   │   └── file-reader.ts     # glob 기반 파일 탐색
│   │   │   ├── ai/                    # AI 엔진
│   │   │   │   ├── types.ts           # AiProvider 인터페이스
│   │   │   │   ├── providers/
│   │   │   │   │   ├── openai.ts
│   │   │   │   │   ├── claude.ts
│   │   │   │   │   ├── gemini.ts
│   │   │   │   │   ├── ollama.ts
│   │   │   │   │   └── custom.ts
│   │   │   │   ├── grouping.ts        # AI 도메인 그룹핑
│   │   │   │   └── prompts/           # 프롬프트 템플릿 (다국어)
│   │   │   ├── generator/             # 문서 생성 엔진
│   │   │   │   ├── types.ts
│   │   │   │   ├── markdown.ts        # unified 기반 MD 생성
│   │   │   │   ├── sidebar.ts         # 사이드바 자동 생성
│   │   │   │   └── templates/         # MD 템플릿
│   │   │   ├── changelog/             # 변경 추적
│   │   │   │   ├── differ.ts
│   │   │   │   └── release.ts
│   │   │   └── index.ts               # public API
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                           # @codedocs/cli — CLI 도구
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── init.ts            # codedocs init (대화형 마법사)
│   │   │   │   ├── analyze.ts         # codedocs analyze
│   │   │   │   ├── generate.ts        # codedocs generate
│   │   │   │   ├── build.ts           # codedocs build (Vite SSG 빌드)
│   │   │   │   ├── serve.ts           # codedocs serve (로컬 프리뷰)
│   │   │   │   └── release.ts         # codedocs release
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── theme/                         # @codedocs/theme — UI 테마
│   │   ├── src/
│   │   │   ├── app/                   # React SPA 엔트리
│   │   │   │   ├── App.tsx
│   │   │   │   ├── Layout.tsx         # 사이드바 + 콘텐츠 레이아웃
│   │   │   │   └── Router.tsx         # 클라이언트 라우팅
│   │   │   ├── components/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── SearchBar.tsx      # Pagefind 연동
│   │   │   │   ├── ApiEndpointCard.tsx
│   │   │   │   ├── EntityCard.tsx
│   │   │   │   ├── MermaidChart.tsx
│   │   │   │   ├── MemoButton.tsx     # 기존 코드 마이그레이션
│   │   │   │   └── MemoViewer.tsx
│   │   │   ├── css/
│   │   │   │   ├── variables.css      # CSS 변수 (테마 커스텀)
│   │   │   │   ├── base.css
│   │   │   │   ├── components.css
│   │   │   │   └── dark-mode.css
│   │   │   └── pages/
│   │   │       └── index.tsx          # 대시보드
│   │   └── package.json
│   │
│   ├── vite-plugin/                   # @codedocs/vite-plugin — Vite SSG 플러그인
│   │   ├── src/
│   │   │   ├── index.ts               # Vite 플러그인 엔트리
│   │   │   ├── ssg.ts                 # 정적 사이트 생성 로직
│   │   │   ├── markdown-loader.ts     # remark/rehype MD→HTML 파이프라인
│   │   │   └── dev-server.ts          # HMR dev server
│   │   └── package.json
│   │
│   └── parsers/                       # 빌트인 파서 패키지들
│       ├── kotlin-spring/             # @codedocs/parser-kotlin-spring
│       │   ├── src/
│       │   │   ├── index.ts
│       │   │   ├── rest-parser.ts
│       │   │   ├── graphql-parser.ts
│       │   │   ├── entity-parser.ts
│       │   │   └── service-parser.ts
│       │   └── package.json
│       ├── java-spring/               # @codedocs/parser-java-spring
│       ├── typescript-nestjs/         # @codedocs/parser-typescript-nestjs
│       ├── python-fastapi/            # @codedocs/parser-python-fastapi
│       ├── openapi/                   # @codedocs/parser-openapi
│       ├── go/                        # @codedocs/parser-go
│       ├── graphql/                   # @codedocs/parser-graphql
│       ├── react/                     # @codedocs/parser-react
│       ├── vue/                       # @codedocs/parser-vue
│       └── svelte/                    # @codedocs/parser-svelte
│
├── templates/                         # CI/CD + 프로젝트 템플릿
│   ├── ci/
│   │   ├── github-actions.yml.hbs
│   │   ├── gitlab-ci.yml.hbs
│   │   └── jenkinsfile.hbs
│   └── project/
│       ├── default/
│       └── minimal/
│
├── examples/
│   └── kotlin-spring-example/
│
├── package.json                       # monorepo root
├── turbo.json
├── tsconfig.base.json
└── README.md
```

---

## 5. 단계별 구현 계획

### Phase 1: 코어 + MVP (Foundation) ✅ 완료

> **목표**: 모노레포 구조 세팅 → 핵심 엔진 구현 → `npx codedocs build`가 동작하는 MVP

| # | 태스크 | 설명 | 상태 |
|---|--------|------|------|
| 1 | monorepo 구조 세팅 | Turborepo + npm workspaces + tsconfig 통합 | ✅ |
| 2 | `@codedocs/core`: 설정 스키마 + 로더 | Zod 기반 `codedocs.config.ts` 파싱 | ✅ |
| 3 | `@codedocs/core`: 파서 엔진 | ParserPlugin 인터페이스 + 실행 엔진 + 파일 리더 | ✅ |
| 4 | `@codedocs/core`: AI 엔진 | ai-provider.ts 모듈화 + Ollama 추가 | ✅ |
| 5 | `@codedocs/parser-kotlin-spring` | analyze-imos.ts → 표준 파서 마이그레이션 | ✅ |
| 6 | `@codedocs/core`: Markdown 생성기 | unified 기반 MD 생성 + 템플릿 시스템 | ✅ |
| 7 | `@codedocs/core`: 사이드바 생성기 | 설정 + 분석 결과 → 사이드바 JSON | ✅ |
| 8 | `@codedocs/vite-plugin` | Vite SSG 플러그인 (MD→HTML, 라우팅, 빌드) | ✅ |
| 9 | `@codedocs/theme` | React 테마 (Layout, Sidebar, ApiCard 등) | ✅ |
| 10 | `@codedocs/cli` | init / analyze / generate / build / serve | ✅ |
| 11 | Changelog / Release | differ.ts + release.ts 리팩토링 | ✅ |
| 12 | CI/CD 템플릿 | Jenkins, GitHub Actions, GitLab CI | - |

### Phase 2: 파서 확장 + 사용성 ✅ 완료

| # | 태스크 | 상태 |
|---|--------|------|
| 13 | `@codedocs/parser-java-spring` | ✅ |
| 14 | `@codedocs/parser-typescript-nestjs` | ✅ |
| 15 | `@codedocs/parser-python-fastapi` | ✅ |
| 16 | `@codedocs/parser-openapi` | ✅ |
| 17 | AI 프롬프트 다국어 지원 (ko/en/ja/zh) | ✅ |
| 18 | `codedocs init` 자동 스택 감지 | ✅ |
| 19 | 페이지별 메타 태그 오버라이드 | ✅ |
| 20 | 테마 프리셋 추가 (default, swagger, redoc, mintlify) | ✅ |

### Phase 3: 고도화 ✅ 완료

| # | 태스크 | 상태 |
|---|--------|------|
| 21 | API Playground (Postman-like) | ✅ |
| 22 | Request/Response 예시 AI 자동 생성 | ✅ |
| 23 | `@codedocs/parser-go` (Gin/Echo/Fiber/Chi + GORM) | ✅ |
| 24 | `@codedocs/parser-graphql` (SDL 파싱) | ✅ |
| 25 | `@codedocs/parser-react` / `parser-vue` / `parser-svelte` | ✅ |
| 26 | AI 시맨틱 검색 (TF-IDF + Embedding) | ✅ |
| 27 | 다이어그램 자동 생성 강화 (7종 Mermaid) | ✅ |
| 28 | 버전 비교 뷰 (Breaking Change 감지) | ✅ |

---

## 6. npm 패키지 배포 구조

```
@codedocs/core                        # 핵심 엔진 (파서, AI, 생성기, 검색, 다이어그램, 변경추적)
@codedocs/cli                         # CLI (npx codedocs ...)
@codedocs/theme                       # React 테마 (Playground, VersionCompare, 프리셋)
@codedocs/vite-plugin                 # Vite SSG 플러그인
@codedocs/parser-kotlin-spring        # Kotlin+Spring 파서
@codedocs/parser-java-spring          # Java+Spring 파서
@codedocs/parser-typescript-nestjs    # NestJS 파서
@codedocs/parser-python-fastapi       # FastAPI 파서
@codedocs/parser-openapi              # OpenAPI/Swagger 파서
@codedocs/parser-go                   # Go+Gin/Echo/Fiber/Chi+GORM 파서
@codedocs/parser-graphql              # GraphQL SDL 파서
@codedocs/parser-react                # React+Next.js 파서
@codedocs/parser-vue                  # Vue+Nuxt 파서
@codedocs/parser-svelte               # Svelte+SvelteKit 파서
codedocs                              # 메타 패키지 (core + cli + theme + vite-plugin)
```

---

## 7. 현재 코드 → 신규 구조 매핑

| 현재 파일 | 이동 위치 | 변경 사항 |
|----------|-----------|-----------|
| `scripts/analyze-imos.ts` | `packages/parsers/kotlin-spring/src/` | ParserPlugin 구현, IMOS 하드코딩 제거 |
| `scripts/ai-provider.ts` | `packages/core/src/ai/providers/` | 프로바이더별 분리 + Ollama 추가 |
| `scripts/ai-grouping.ts` | `packages/core/src/ai/grouping.ts` | 프롬프트 템플릿화, 다국어 |
| `scripts/generate-markdown.ts` | `packages/core/src/generator/markdown.ts` | unified 기반 + 템플릿 시스템 |
| `scripts/generate-changelog.ts` | `packages/core/src/changelog/differ.ts` | 범용 비교 함수 |
| `scripts/generate-release-note.ts` | `packages/core/src/changelog/release.ts` | 언어 무관 범용화 |
| `src/css/custom.css` | `packages/theme/src/css/` | CSS 변수 기반 리팩토링 |
| `src/theme/Root.tsx` | `packages/theme/src/app/` | Vite SSG에 맞게 재구현 |
| `src/components/MemoButton.tsx` | `packages/theme/src/components/` | 독립 컴포넌트화 |
| `src/components/MemoViewer.tsx` | `packages/theme/src/components/` | 독립 컴포넌트화 |
| `src/pages/index.tsx` | `packages/theme/src/pages/` | 설정 기반 동적 대시보드 |
| `.gitlab-ci.yml` | `templates/ci/gitlab-ci.yml.hbs` | 템플릿화 |
| `.github/workflows/` | `templates/ci/github-actions.yml.hbs` | 템플릿화 |

---

## 8. 사용자 경험 플로우

### 8.1 Quick Start

```bash
# 1. 초기화 (대화형 마법사)
npx codedocs init

# 2. 분석 + 문서 생성 + 빌드 (한 명령어)
npx codedocs build

# 3. 로컬 프리뷰
npx codedocs serve
# → http://localhost:4321 에서 문서 확인
```

### 8.2 커스텀 파서 사용

```typescript
// codedocs.config.ts
import { defineConfig } from '@codedocs/core';

export default defineConfig({
  source: './src',
  parsers: [{
    name: 'my-django-parser',
    filePattern: '**/*.py',
    parse(files) {
      // Django URL patterns + Models 파싱
      return { endpoints: [...], entities: [...] };
    },
  }],
  ai: { provider: 'ollama', model: 'codellama:34b' },
});
```

---

**현재 상태**: Phase 1~3 구현 완료. 모든 핵심 기능 및 10개 파서 구현됨.
