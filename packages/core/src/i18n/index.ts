// packages/core/src/i18n/index.ts
// Internationalization support for CodeDocs

export type Locale = 'ko' | 'en' | 'ja' | 'zh';

export interface I18nStrings {
  // Overview page
  overview: {
    title: string;
    projectOverview: string;
    version: string;
    lastUpdated: string;
    sourceDirectory: string;
    statistics: string;
    category: string;
    count: string;
    totalFiles: string;
    endpoints: string;
    entities: string;
    services: string;
    types: string;
    parsersUsed: string;
    quickLinks: string;
    apiEndpoints: string;
    databaseEntities: string;
    architectureOverview: string;
    changelog: string;
  };
  // Endpoint pages
  endpoint: {
    parameters: string;
    name: string;
    type: string;
    required: string;
    location: string;
    defaultValue: string;
    description: string;
    returnType: string;
    service: string;
    tags: string;
    source: string;
    authRequired: string;
    deprecated: string;
  };
  // Entity pages
  entity: {
    tableName: string;
    databaseType: string;
    columns: string;
    column: string;
    dbName: string;
    nullable: string;
    primary: string;
    unique: string;
    relations: string;
    target: string;
    joinColumn: string;
    mappedBy: string;
    eager: string;
    erDiagram: string;
    indexes: string;
  };
  // Architecture page
  architecture: {
    title: string;
    services: string;
    totalServices: string;
    serviceDependencies: string;
    dependencies: string;
    methods: string;
    dependencyGraph: string;
    moduleStatistics: string;
  };
  // Changelog
  changelog: {
    title: string;
    unreleased: string;
    unreleasedDesc: string;
    howToUse: string;
    howToUseDesc: string;
    added: string;
    removed: string;
    changed: string;
    fixed: string;
  };
  // Common
  common: {
    overview: string;
    api: string;
    dataModels: string;
    architecture: string;
    search: string;
    darkMode: string;
    lightMode: string;
    generatedBy: string;
  };
  // Theme component strings
  theme: {
    // ApiEndpointCard
    returns: string;
    parameters: string;
    name: string;
    type: string;
    required: string;
    location: string;
    deprecated: string;
    authRequired: string;
    // EntityCard
    columns: string;
    column: string;
    field: string;
    nullable: string;
    pk: string;
    relations: string;
    nColumns: string; // "{n} columns" pattern
    // ApiPlayground
    send: string;
    sending: string;
    pathParameters: string;
    queryParameters: string;
    noParameters: string;
    headers: string;
    body: string;
    auth: string;
    response: string;
    bearerToken: string;
    apiKey: string;
    basicAuth: string;
    token: string;
    select: string;
    fields: string;
    description: string;
    headerName: string;
    headerValue: string;
    // VersionCompare
    breakingChanges: string;
    critical: string;
    warning: string;
    added: string;
    removed: string;
    modified: string;
    unchanged: string;
    status: string;
    previous: string;
    current: string;
    endpoints: string;
    entities: string;
    types: string;
    services: string;
    nAdded: string;
    nRemoved: string;
    nModified: string;
    nBreaking: string;
    // Layout
    toggleDarkMode: string;
  };
}

const en: I18nStrings = {
  overview: {
    title: 'API Documentation',
    projectOverview: 'Project Overview',
    version: 'Version',
    lastUpdated: 'Last Updated',
    sourceDirectory: 'Source Directory',
    statistics: 'Statistics',
    category: 'Category',
    count: 'Count',
    totalFiles: 'Total Files',
    endpoints: 'Endpoints',
    entities: 'Entities',
    services: 'Services',
    types: 'Types',
    parsersUsed: 'Parsers Used',
    quickLinks: 'Quick Links',
    apiEndpoints: 'API Endpoints',
    databaseEntities: 'Database Entities',
    architectureOverview: 'Architecture Overview',
    changelog: 'Changelog',
  },
  endpoint: {
    parameters: 'Parameters',
    name: 'Name',
    type: 'Type',
    required: 'Required',
    location: 'Location',
    defaultValue: 'Default',
    description: 'Description',
    returnType: 'Return Type',
    service: 'Service',
    tags: 'Tags',
    source: 'Source',
    authRequired: 'Auth Required',
    deprecated: 'Deprecated',
  },
  entity: {
    tableName: 'Table Name',
    databaseType: 'Database Type',
    columns: 'Columns',
    column: 'Column',
    dbName: 'DB Name',
    nullable: 'Nullable',
    primary: 'Primary',
    unique: 'Unique',
    relations: 'Relations',
    target: 'Target',
    joinColumn: 'Join Column',
    mappedBy: 'Mapped By',
    eager: 'Eager',
    erDiagram: 'Entity Relationship Diagram',
    indexes: 'Indexes',
  },
  architecture: {
    title: 'Architecture Overview',
    services: 'Services',
    totalServices: 'Total services',
    serviceDependencies: 'Service Dependencies',
    dependencies: 'Dependencies',
    methods: 'Methods',
    dependencyGraph: 'Dependency Graph',
    moduleStatistics: 'Module Statistics',
  },
  changelog: {
    title: 'Changelog',
    unreleased: 'Unreleased',
    unreleasedDesc: 'Changes not yet released.',
    howToUse: 'How to Use',
    howToUseDesc: 'The changelog is automatically generated by comparing analysis snapshots.\nRun `codedocs changelog` to update this file.',
    added: 'Added',
    removed: 'Removed',
    changed: 'Changed',
    fixed: 'Fixed',
  },
  common: {
    overview: 'Overview',
    api: 'API',
    dataModels: 'Data Models',
    architecture: 'Architecture',
    search: 'Search',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    generatedBy: 'Generated by CodeDocs',
  },
  theme: {
    returns: 'Returns',
    parameters: 'Parameters',
    name: 'Name',
    type: 'Type',
    required: 'Required',
    location: 'Location',
    deprecated: 'deprecated',
    authRequired: 'Authentication required',
    columns: 'Columns',
    column: 'Column',
    field: 'Field',
    nullable: 'Nullable',
    pk: 'PK',
    relations: 'Relations',
    nColumns: '{n} columns',
    send: 'Send',
    sending: 'Sending...',
    pathParameters: 'Path Parameters',
    queryParameters: 'Query Parameters',
    noParameters: 'No parameters for this endpoint.',
    headers: 'Headers',
    body: 'Body',
    auth: 'Auth',
    response: 'Response',
    bearerToken: 'Bearer Token',
    apiKey: 'API Key',
    basicAuth: 'Basic Auth',
    token: 'Token',
    select: 'Select...',
    fields: 'Fields',
    description: 'Description',
    headerName: 'Header name',
    headerValue: 'Header value',
    breakingChanges: 'Breaking Changes',
    critical: 'CRITICAL',
    warning: 'WARNING',
    added: 'added',
    removed: 'removed',
    modified: 'modified',
    unchanged: 'unchanged',
    status: 'Status',
    previous: 'Previous',
    current: 'Current',
    endpoints: 'Endpoints',
    entities: 'Entities',
    types: 'Types',
    services: 'Services',
    nAdded: '+{n} added',
    nRemoved: '-{n} removed',
    nModified: '~{n} modified',
    nBreaking: '{n} breaking',
    toggleDarkMode: 'Toggle dark mode',
  },
};

const ko: I18nStrings = {
  overview: {
    title: 'API 문서',
    projectOverview: '프로젝트 개요',
    version: '버전',
    lastUpdated: '최종 업데이트',
    sourceDirectory: '소스 디렉토리',
    statistics: '통계',
    category: '카테고리',
    count: '수량',
    totalFiles: '전체 파일',
    endpoints: '엔드포인트',
    entities: '엔티티',
    services: '서비스',
    types: '타입',
    parsersUsed: '사용된 파서',
    quickLinks: '바로가기',
    apiEndpoints: 'API 엔드포인트',
    databaseEntities: '데이터베이스 엔티티',
    architectureOverview: '아키텍처 개요',
    changelog: '변경 이력',
  },
  endpoint: {
    parameters: '파라미터',
    name: '이름',
    type: '타입',
    required: '필수',
    location: '위치',
    defaultValue: '기본값',
    description: '설명',
    returnType: '반환 타입',
    service: '서비스',
    tags: '태그',
    source: '소스',
    authRequired: '인증 필요',
    deprecated: '지원 중단',
  },
  entity: {
    tableName: '테이블명',
    databaseType: '데이터베이스 종류',
    columns: '컬럼',
    column: '컬럼',
    dbName: 'DB 컬럼명',
    nullable: 'Nullable',
    primary: '기본키',
    unique: '유니크',
    relations: '관계',
    target: '대상',
    joinColumn: '조인 컬럼',
    mappedBy: '매핑',
    eager: '즉시 로딩',
    erDiagram: 'ER 다이어그램',
    indexes: '인덱스',
  },
  architecture: {
    title: '아키텍처 개요',
    services: '서비스',
    totalServices: '전체 서비스 수',
    serviceDependencies: '서비스 의존성',
    dependencies: '의존성',
    methods: '메소드',
    dependencyGraph: '의존성 그래프',
    moduleStatistics: '모듈 통계',
  },
  changelog: {
    title: '변경 이력',
    unreleased: '미출시',
    unreleasedDesc: '아직 출시되지 않은 변경 사항입니다.',
    howToUse: '사용 방법',
    howToUseDesc: '변경 이력은 분석 스냅샷을 비교하여 자동 생성됩니다.\n`codedocs changelog` 명령어로 업데이트할 수 있습니다.',
    added: '추가',
    removed: '삭제',
    changed: '변경',
    fixed: '수정',
  },
  common: {
    overview: '개요',
    api: 'API',
    dataModels: '데이터 모델',
    architecture: '아키텍처',
    search: '검색',
    darkMode: '다크 모드',
    lightMode: '라이트 모드',
    generatedBy: 'CodeDocs로 생성됨',
  },
  theme: {
    returns: '반환값',
    parameters: '파라미터',
    name: '이름',
    type: '타입',
    required: '필수',
    location: '위치',
    deprecated: '지원 중단',
    authRequired: '인증 필요',
    columns: '컬럼',
    column: '컬럼',
    field: '필드',
    nullable: 'Nullable',
    pk: 'PK',
    relations: '관계',
    nColumns: '{n}개 컬럼',
    send: '전송',
    sending: '전송 중...',
    pathParameters: '경로 파라미터',
    queryParameters: '쿼리 파라미터',
    noParameters: '이 엔드포인트에 파라미터가 없습니다.',
    headers: '헤더',
    body: '본문',
    auth: '인증',
    response: '응답',
    bearerToken: 'Bearer 토큰',
    apiKey: 'API 키',
    basicAuth: '기본 인증',
    token: '토큰',
    select: '선택...',
    fields: '필드',
    description: '설명',
    headerName: '헤더 이름',
    headerValue: '헤더 값',
    breakingChanges: '호환성 깨짐',
    critical: '심각',
    warning: '경고',
    added: '추가',
    removed: '삭제',
    modified: '변경',
    unchanged: '변경 없음',
    status: '상태',
    previous: '이전',
    current: '현재',
    endpoints: '엔드포인트',
    entities: '엔티티',
    types: '타입',
    services: '서비스',
    nAdded: '+{n} 추가',
    nRemoved: '-{n} 삭제',
    nModified: '~{n} 변경',
    nBreaking: '{n} 호환성 깨짐',
    toggleDarkMode: '다크 모드 전환',
  },
};

const ja: I18nStrings = {
  overview: {
    title: 'APIドキュメント',
    projectOverview: 'プロジェクト概要',
    version: 'バージョン',
    lastUpdated: '最終更新',
    sourceDirectory: 'ソースディレクトリ',
    statistics: '統計',
    category: 'カテゴリ',
    count: '件数',
    totalFiles: '総ファイル数',
    endpoints: 'エンドポイント',
    entities: 'エンティティ',
    services: 'サービス',
    types: 'タイプ',
    parsersUsed: '使用パーサー',
    quickLinks: 'クイックリンク',
    apiEndpoints: 'APIエンドポイント',
    databaseEntities: 'データベースエンティティ',
    architectureOverview: 'アーキテクチャ概要',
    changelog: '変更履歴',
  },
  endpoint: {
    parameters: 'パラメータ',
    name: '名前',
    type: 'タイプ',
    required: '必須',
    location: '位置',
    defaultValue: 'デフォルト',
    description: '説明',
    returnType: '戻り値の型',
    service: 'サービス',
    tags: 'タグ',
    source: 'ソース',
    authRequired: '認証必要',
    deprecated: '非推奨',
  },
  entity: {
    tableName: 'テーブル名',
    databaseType: 'データベース種類',
    columns: 'カラム',
    column: 'カラム',
    dbName: 'DBカラム名',
    nullable: 'Nullable',
    primary: '主キー',
    unique: 'ユニーク',
    relations: 'リレーション',
    target: '対象',
    joinColumn: '結合カラム',
    mappedBy: 'マッピング',
    eager: '即時読込',
    erDiagram: 'ER図',
    indexes: 'インデックス',
  },
  architecture: {
    title: 'アーキテクチャ概要',
    services: 'サービス',
    totalServices: 'サービス合計',
    serviceDependencies: 'サービス依存関係',
    dependencies: '依存関係',
    methods: 'メソッド',
    dependencyGraph: '依存関係グラフ',
    moduleStatistics: 'モジュール統計',
  },
  changelog: {
    title: '変更履歴',
    unreleased: '未リリース',
    unreleasedDesc: 'まだリリースされていない変更です。',
    howToUse: '使い方',
    howToUseDesc: '変更履歴は分析スナップショットの比較で自動生成されます。\n`codedocs changelog`コマンドで更新できます。',
    added: '追加',
    removed: '削除',
    changed: '変更',
    fixed: '修正',
  },
  common: {
    overview: '概要',
    api: 'API',
    dataModels: 'データモデル',
    architecture: 'アーキテクチャ',
    search: '検索',
    darkMode: 'ダークモード',
    lightMode: 'ライトモード',
    generatedBy: 'CodeDocsで生成',
  },
  theme: {
    returns: '戻り値',
    parameters: 'パラメータ',
    name: '名前',
    type: 'タイプ',
    required: '必須',
    location: '位置',
    deprecated: '非推奨',
    authRequired: '認証必要',
    columns: 'カラム',
    column: 'カラム',
    field: 'フィールド',
    nullable: 'Nullable',
    pk: 'PK',
    relations: 'リレーション',
    nColumns: '{n}カラム',
    send: '送信',
    sending: '送信中...',
    pathParameters: 'パスパラメータ',
    queryParameters: 'クエリパラメータ',
    noParameters: 'このエンドポイントにパラメータはありません。',
    headers: 'ヘッダー',
    body: 'ボディ',
    auth: '認証',
    response: 'レスポンス',
    bearerToken: 'Bearerトークン',
    apiKey: 'APIキー',
    basicAuth: 'Basic認証',
    token: 'トークン',
    select: '選択...',
    fields: 'フィールド',
    description: '説明',
    headerName: 'ヘッダー名',
    headerValue: 'ヘッダー値',
    breakingChanges: '破壊的変更',
    critical: '重大',
    warning: '警告',
    added: '追加',
    removed: '削除',
    modified: '変更',
    unchanged: '変更なし',
    status: 'ステータス',
    previous: '以前',
    current: '現在',
    endpoints: 'エンドポイント',
    entities: 'エンティティ',
    types: 'タイプ',
    services: 'サービス',
    nAdded: '+{n}追加',
    nRemoved: '-{n}削除',
    nModified: '~{n}変更',
    nBreaking: '{n}破壊的変更',
    toggleDarkMode: 'ダークモード切替',
  },
};

const zh: I18nStrings = {
  overview: {
    title: 'API 文档',
    projectOverview: '项目概述',
    version: '版本',
    lastUpdated: '最后更新',
    sourceDirectory: '源代码目录',
    statistics: '统计',
    category: '类别',
    count: '数量',
    totalFiles: '总文件数',
    endpoints: '端点',
    entities: '实体',
    services: '服务',
    types: '类型',
    parsersUsed: '使用的解析器',
    quickLinks: '快速链接',
    apiEndpoints: 'API 端点',
    databaseEntities: '数据库实体',
    architectureOverview: '架构概述',
    changelog: '更新日志',
  },
  endpoint: {
    parameters: '参数',
    name: '名称',
    type: '类型',
    required: '必填',
    location: '位置',
    defaultValue: '默认值',
    description: '描述',
    returnType: '返回类型',
    service: '服务',
    tags: '标签',
    source: '源文件',
    authRequired: '需要认证',
    deprecated: '已弃用',
  },
  entity: {
    tableName: '表名',
    databaseType: '数据库类型',
    columns: '列',
    column: '列',
    dbName: 'DB列名',
    nullable: '可空',
    primary: '主键',
    unique: '唯一',
    relations: '关系',
    target: '目标',
    joinColumn: '关联列',
    mappedBy: '映射',
    eager: '即时加载',
    erDiagram: 'ER 图',
    indexes: '索引',
  },
  architecture: {
    title: '架构概述',
    services: '服务',
    totalServices: '服务总数',
    serviceDependencies: '服务依赖',
    dependencies: '依赖',
    methods: '方法',
    dependencyGraph: '依赖图',
    moduleStatistics: '模块统计',
  },
  changelog: {
    title: '更新日志',
    unreleased: '未发布',
    unreleasedDesc: '尚未发布的更改。',
    howToUse: '使用方法',
    howToUseDesc: '更新日志通过比较分析快照自动生成。\n运行 `codedocs changelog` 来更新此文件。',
    added: '新增',
    removed: '删除',
    changed: '变更',
    fixed: '修复',
  },
  common: {
    overview: '概述',
    api: 'API',
    dataModels: '数据模型',
    architecture: '架构',
    search: '搜索',
    darkMode: '暗黑模式',
    lightMode: '明亮模式',
    generatedBy: '由 CodeDocs 生成',
  },
  theme: {
    returns: '返回值',
    parameters: '参数',
    name: '名称',
    type: '类型',
    required: '必填',
    location: '位置',
    deprecated: '已弃用',
    authRequired: '需要认证',
    columns: '列',
    column: '列',
    field: '字段',
    nullable: '可空',
    pk: '主键',
    relations: '关系',
    nColumns: '{n}列',
    send: '发送',
    sending: '发送中...',
    pathParameters: '路径参数',
    queryParameters: '查询参数',
    noParameters: '此端点没有参数。',
    headers: '请求头',
    body: '请求体',
    auth: '认证',
    response: '响应',
    bearerToken: 'Bearer令牌',
    apiKey: 'API密钥',
    basicAuth: '基本认证',
    token: '令牌',
    select: '选择...',
    fields: '字段',
    description: '描述',
    headerName: '请求头名称',
    headerValue: '请求头值',
    breakingChanges: '破坏性变更',
    critical: '严重',
    warning: '警告',
    added: '新增',
    removed: '删除',
    modified: '修改',
    unchanged: '未变更',
    status: '状态',
    previous: '之前',
    current: '当前',
    endpoints: '端点',
    entities: '实体',
    types: '类型',
    services: '服务',
    nAdded: '+{n}新增',
    nRemoved: '-{n}删除',
    nModified: '~{n}修改',
    nBreaking: '{n}破坏性变更',
    toggleDarkMode: '切换暗黑模式',
  },
};

const locales: Record<Locale, I18nStrings> = { en, ko, ja, zh };

/**
 * Get i18n strings for the given locale
 */
export function getStrings(locale: Locale): I18nStrings {
  return locales[locale] || locales.en;
}

/**
 * Get all supported locales
 */
export function getSupportedLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}
