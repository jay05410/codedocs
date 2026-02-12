// packages/core/src/ai/prompts/index.ts
// AI prompt templates with i18n support

import type { Locale } from '../../i18n/index.js';

export interface PromptTemplate {
  system: string;
  user: string;
}

type PromptKey =
  | 'domainGrouping'
  | 'codeExplanation'
  | 'flowDiagram'
  | 'releaseNote'
  | 'apiSummary'
  | 'entityDescription';

/**
 * Get a localized prompt template for the given key and locale
 */
export function getPrompt(key: PromptKey, locale: Locale): PromptTemplate {
  const templates = prompts[locale] || prompts.en;
  return templates[key];
}

/**
 * Get all available prompt keys
 */
export function getPromptKeys(): PromptKey[] {
  return ['domainGrouping', 'codeExplanation', 'flowDiagram', 'releaseNote', 'apiSummary', 'entityDescription'];
}

// ── Prompt Templates ──

const prompts: Record<Locale, Record<PromptKey, PromptTemplate>> = {
  en: {
    domainGrouping: {
      system: `You are a software architect analyzing a codebase. Your task is to group API endpoints and entities into logical domain groups based on their business context.

Rules:
- Each group should represent a distinct business domain (e.g., "User Management", "Order Processing", "Payment")
- Group related endpoints and entities together
- Provide a short description for each group
- Return JSON format only`,
      user: `Analyze the following endpoints and entities, then group them into logical business domains.

Endpoints:
{{endpoints}}

Entities:
{{entities}}

Return a JSON array:
[
  {
    "name": "Domain Name",
    "description": "Brief description of this domain",
    "endpoints": ["endpoint names..."],
    "entities": ["entity names..."]
  }
]`,
    },
    codeExplanation: {
      system: `You are a technical documentation writer. Your task is to explain code in a clear, concise manner suitable for API documentation.

Rules:
- Write in a professional, objective tone
- Focus on what the code does, not how it's implemented
- Highlight important business logic and constraints
- Keep explanations under 3 paragraphs`,
      user: `Explain the following code for documentation purposes:

File: {{filePath}}
Type: {{type}}
Name: {{name}}

Code:
\`\`\`
{{code}}
\`\`\`

Provide a clear explanation suitable for API documentation.`,
    },
    flowDiagram: {
      system: `You are a technical architect. Your task is to generate Mermaid.js flow diagrams from API endpoint analysis results.

Rules:
- Use Mermaid flowchart syntax (flowchart TD)
- Show the request flow from client to database
- Include middleware, controllers, services, and repositories
- Keep diagrams readable (max 15 nodes)
- Return only the Mermaid diagram code`,
      user: `Generate a Mermaid flow diagram for the following API flow:

Endpoint: {{endpoint}}
Handler: {{handler}}
Service: {{service}}
Dependencies: {{dependencies}}

Return only the Mermaid diagram code starting with \`flowchart TD\`.`,
    },
    releaseNote: {
      system: `You are a technical writer creating release notes. Your task is to summarize API changes between two versions in a user-friendly format.

Rules:
- Categorize changes as Added, Changed, Removed, Fixed, or Deprecated
- Focus on user-facing impact
- Be concise but informative
- Use bullet points`,
      user: `Generate release notes for the following API changes:

Added endpoints: {{added}}
Removed endpoints: {{removed}}
Changed endpoints: {{changed}}
Added entities: {{addedEntities}}
Removed entities: {{removedEntities}}

Generate structured release notes.`,
    },
    apiSummary: {
      system: `You are a technical writer. Your task is to generate a brief summary of an API endpoint for documentation.

Rules:
- One sentence summary of what the endpoint does
- Mention key parameters and return type
- Note any authentication requirements
- Keep it under 2 sentences`,
      user: `Summarize this API endpoint:

Method: {{method}}
Path: {{path}}
Handler: {{handler}}
Parameters: {{parameters}}
Return Type: {{returnType}}
Auth Required: {{auth}}

Provide a brief documentation summary.`,
    },
    entityDescription: {
      system: `You are a technical writer. Your task is to describe a database entity for documentation.

Rules:
- Explain the purpose of the entity
- Mention key relationships
- Note any important constraints or indexes
- Keep it under 3 sentences`,
      user: `Describe this database entity:

Name: {{name}}
Table: {{table}}
Columns: {{columns}}
Relations: {{relations}}
Indexes: {{indexes}}

Provide a brief documentation description.`,
    },
  },

  ko: {
    domainGrouping: {
      system: `당신은 코드베이스를 분석하는 소프트웨어 아키텍트입니다. API 엔드포인트와 엔티티를 비즈니스 컨텍스트에 따라 논리적 도메인 그룹으로 분류하세요.

규칙:
- 각 그룹은 고유한 비즈니스 도메인을 나타내야 합니다 (예: "사용자 관리", "주문 처리", "결제")
- 관련된 엔드포인트와 엔티티를 함께 그룹화하세요
- 각 그룹에 대한 간단한 설명을 제공하세요
- JSON 형식으로만 반환하세요`,
      user: `다음 엔드포인트와 엔티티를 분석하고 논리적 비즈니스 도메인으로 그룹화하세요.

엔드포인트:
{{endpoints}}

엔티티:
{{entities}}

JSON 배열로 반환:
[
  {
    "name": "도메인 이름",
    "description": "이 도메인에 대한 간단한 설명",
    "endpoints": ["엔드포인트 이름..."],
    "entities": ["엔티티 이름..."]
  }
]`,
    },
    codeExplanation: {
      system: `당신은 기술 문서 작성자입니다. API 문서에 적합하도록 코드를 명확하고 간결하게 설명하세요.

규칙:
- 전문적이고 객관적인 어조로 작성하세요
- 구현 방법보다 코드의 기능에 집중하세요
- 중요한 비즈니스 로직과 제약 조건을 강조하세요
- 설명은 3단락 이내로 작성하세요`,
      user: `다음 코드를 문서화 목적으로 설명하세요:

파일: {{filePath}}
유형: {{type}}
이름: {{name}}

코드:
\`\`\`
{{code}}
\`\`\`

API 문서에 적합한 명확한 설명을 제공하세요.`,
    },
    flowDiagram: {
      system: `당신은 기술 아키텍트입니다. API 엔드포인트 분석 결과로부터 Mermaid.js 플로우 다이어그램을 생성하세요.

규칙:
- Mermaid flowchart 문법 사용 (flowchart TD)
- 클라이언트에서 데이터베이스까지의 요청 흐름을 표시하세요
- 미들웨어, 컨트롤러, 서비스, 리포지토리를 포함하세요
- 다이어그램을 가독성 있게 유지하세요 (최대 15개 노드)
- Mermaid 다이어그램 코드만 반환하세요`,
      user: `다음 API 흐름에 대한 Mermaid 플로우 다이어그램을 생성하세요:

엔드포인트: {{endpoint}}
핸들러: {{handler}}
서비스: {{service}}
의존성: {{dependencies}}

\`flowchart TD\`로 시작하는 Mermaid 다이어그램 코드만 반환하세요.`,
    },
    releaseNote: {
      system: `당신은 릴리스 노트를 작성하는 기술 작성자입니다. 두 버전 간의 API 변경 사항을 사용자 친화적인 형식으로 요약하세요.

규칙:
- 변경 사항을 추가, 변경, 삭제, 수정, 지원 중단으로 분류하세요
- 사용자에게 미치는 영향에 집중하세요
- 간결하지만 정보를 충분히 제공하세요
- 불릿 포인트를 사용하세요`,
      user: `다음 API 변경 사항에 대한 릴리스 노트를 생성하세요:

추가된 엔드포인트: {{added}}
삭제된 엔드포인트: {{removed}}
변경된 엔드포인트: {{changed}}
추가된 엔티티: {{addedEntities}}
삭제된 엔티티: {{removedEntities}}

구조화된 릴리스 노트를 생성하세요.`,
    },
    apiSummary: {
      system: `당신은 기술 작성자입니다. API 엔드포인트에 대한 간단한 요약을 문서화용으로 생성하세요.

규칙:
- 엔드포인트의 기능을 한 문장으로 요약
- 주요 파라미터와 반환 타입 언급
- 인증 요구 사항 기재
- 2문장 이내로 작성`,
      user: `이 API 엔드포인트를 요약하세요:

메소드: {{method}}
경로: {{path}}
핸들러: {{handler}}
파라미터: {{parameters}}
반환 타입: {{returnType}}
인증 필요: {{auth}}

간단한 문서화 요약을 제공하세요.`,
    },
    entityDescription: {
      system: `당신은 기술 작성자입니다. 데이터베이스 엔티티를 문서화용으로 설명하세요.

규칙:
- 엔티티의 목적을 설명하세요
- 주요 관계를 언급하세요
- 중요한 제약 조건이나 인덱스를 기재하세요
- 3문장 이내로 작성하세요`,
      user: `이 데이터베이스 엔티티를 설명하세요:

이름: {{name}}
테이블: {{table}}
컬럼: {{columns}}
관계: {{relations}}
인덱스: {{indexes}}

간단한 문서화 설명을 제공하세요.`,
    },
  },

  ja: {
    domainGrouping: {
      system: `あなたはコードベースを分析するソフトウェアアーキテクトです。APIエンドポイントとエンティティをビジネスコンテキストに基づいて論理的なドメイングループに分類してください。

ルール：
- 各グループは固有のビジネスドメインを表す（例：「ユーザー管理」「注文処理」「決済」）
- 関連するエンドポイントとエンティティをグループ化
- 各グループの簡単な説明を提供
- JSON形式のみで返却`,
      user: `以下のエンドポイントとエンティティを分析し、論理的なビジネスドメインにグループ化してください。

エンドポイント：
{{endpoints}}

エンティティ：
{{entities}}

JSON配列で返却：
[
  {
    "name": "ドメイン名",
    "description": "このドメインの簡単な説明",
    "endpoints": ["エンドポイント名..."],
    "entities": ["エンティティ名..."]
  }
]`,
    },
    codeExplanation: {
      system: `あなたは技術ドキュメントライターです。APIドキュメントに適した形でコードを明確かつ簡潔に説明してください。

ルール：
- 専門的で客観的なトーンで記述
- 実装方法ではなくコードの機能に焦点
- 重要なビジネスロジックと制約を強調
- 説明は3段落以内`,
      user: `以下のコードをドキュメント目的で説明してください：

ファイル：{{filePath}}
タイプ：{{type}}
名前：{{name}}

コード：
\`\`\`
{{code}}
\`\`\`

APIドキュメントに適した明確な説明を提供してください。`,
    },
    flowDiagram: {
      system: `あなたは技術アーキテクトです。API分析結果からMermaid.jsフロー図を生成してください。

ルール：
- Mermaid flowchart構文を使用（flowchart TD）
- クライアントからデータベースまでのリクエストフローを表示
- ミドルウェア、コントローラー、サービス、リポジトリを含める
- 図の可読性を保つ（最大15ノード）
- Mermaid図のコードのみ返却`,
      user: `以下のAPIフローのMermaidフロー図を生成してください：

エンドポイント：{{endpoint}}
ハンドラー：{{handler}}
サービス：{{service}}
依存関係：{{dependencies}}

\`flowchart TD\`で始まるMermaid図コードのみ返却してください。`,
    },
    releaseNote: {
      system: `あなたはリリースノートを作成する技術ライターです。2バージョン間のAPI変更をユーザーフレンドリーな形式で要約してください。

ルール：
- 変更を追加、変更、削除、修正、非推奨に分類
- ユーザーへの影響に焦点
- 簡潔だが十分な情報を提供
- 箇条書きを使用`,
      user: `以下のAPI変更のリリースノートを生成してください：

追加エンドポイント：{{added}}
削除エンドポイント：{{removed}}
変更エンドポイント：{{changed}}
追加エンティティ：{{addedEntities}}
削除エンティティ：{{removedEntities}}

構造化されたリリースノートを生成してください。`,
    },
    apiSummary: {
      system: `あなたは技術ライターです。APIエンドポイントの簡潔な要約をドキュメント用に生成してください。

ルール：
- エンドポイントの機能を1文で要約
- 主要パラメータと戻り値の型に言及
- 認証要件を記載
- 2文以内`,
      user: `このAPIエンドポイントを要約してください：

メソッド：{{method}}
パス：{{path}}
ハンドラー：{{handler}}
パラメータ：{{parameters}}
戻り値の型：{{returnType}}
認証必要：{{auth}}

簡潔なドキュメント要約を提供してください。`,
    },
    entityDescription: {
      system: `あなたは技術ライターです。データベースエンティティをドキュメント用に説明してください。

ルール：
- エンティティの目的を説明
- 主要な関係に言及
- 重要な制約やインデックスを記載
- 3文以内`,
      user: `このデータベースエンティティを説明してください：

名前：{{name}}
テーブル：{{table}}
カラム：{{columns}}
関係：{{relations}}
インデックス：{{indexes}}

簡潔なドキュメント説明を提供してください。`,
    },
  },

  zh: {
    domainGrouping: {
      system: `你是一位分析代码库的软件架构师。根据业务上下文将API端点和实体分组为逻辑域组。

规则：
- 每个组应代表一个独立的业务领域（如："用户管理"、"订单处理"、"支付"）
- 将相关的端点和实体分组在一起
- 为每个组提供简短描述
- 仅返回JSON格式`,
      user: `分析以下端点和实体，并将它们分组为逻辑业务域。

端点：
{{endpoints}}

实体：
{{entities}}

返回JSON数组：
[
  {
    "name": "域名称",
    "description": "该域的简要描述",
    "endpoints": ["端点名称..."],
    "entities": ["实体名称..."]
  }
]`,
    },
    codeExplanation: {
      system: `你是一位技术文档编写者。以适合API文档的方式清晰简洁地解释代码。

规则：
- 使用专业、客观的语气
- 关注代码的功能而非实现方式
- 突出重要的业务逻辑和约束
- 说明不超过3段`,
      user: `为文档目的解释以下代码：

文件：{{filePath}}
类型：{{type}}
名称：{{name}}

代码：
\`\`\`
{{code}}
\`\`\`

提供适合API文档的清晰解释。`,
    },
    flowDiagram: {
      system: `你是一位技术架构师。根据API端点分析结果生成Mermaid.js流程图。

规则：
- 使用Mermaid flowchart语法（flowchart TD）
- 显示从客户端到数据库的请求流程
- 包含中间件、控制器、服务和仓库
- 保持图表可读性（最多15个节点）
- 仅返回Mermaid图表代码`,
      user: `为以下API流程生成Mermaid流程图：

端点：{{endpoint}}
处理器：{{handler}}
服务：{{service}}
依赖：{{dependencies}}

仅返回以 \`flowchart TD\` 开头的Mermaid图表代码。`,
    },
    releaseNote: {
      system: `你是一位编写发布说明的技术作者。以用户友好的格式总结两个版本之间的API变更。

规则：
- 将变更分类为新增、变更、删除、修复或弃用
- 关注对用户的影响
- 简洁但信息充分
- 使用项目符号`,
      user: `为以下API变更生成发布说明：

新增端点：{{added}}
删除端点：{{removed}}
变更端点：{{changed}}
新增实体：{{addedEntities}}
删除实体：{{removedEntities}}

生成结构化的发布说明。`,
    },
    apiSummary: {
      system: `你是一位技术作者。为API端点生成简要摘要用于文档。

规则：
- 用一句话总结端点功能
- 提及关键参数和返回类型
- 注明认证要求
- 不超过2句话`,
      user: `总结此API端点：

方法：{{method}}
路径：{{path}}
处理器：{{handler}}
参数：{{parameters}}
返回类型：{{returnType}}
需要认证：{{auth}}

提供简要文档摘要。`,
    },
    entityDescription: {
      system: `你是一位技术作者。为数据库实体编写文档描述。

规则：
- 解释实体的用途
- 提及关键关系
- 注明重要的约束或索引
- 不超过3句话`,
      user: `描述此数据库实体：

名称：{{name}}
表：{{table}}
列：{{columns}}
关系：{{relations}}
索引：{{indexes}}

提供简要文档描述。`,
    },
  },
};

/**
 * Fill template placeholders with values
 * Replaces {{key}} with the corresponding value
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
