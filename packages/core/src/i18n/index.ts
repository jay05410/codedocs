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
  // CLI strings
  cli: {
    // General
    appDescription: string;
    configNotFound: string;
    runInitFirst: string;

    // Init command
    initTitle: string;
    detectingStack: string;
    stackDetected: string;
    stackDetectFailed: string;
    projectName: string;
    projectNameRequired: string;
    sourceCodePath: string;
    primaryLanguage: string;
    selectParsers: string;
    aiProvider: string;
    aiModel: string;
    apiKeyPrompt: string;
    docLanguage: string;
    deployTarget: string;
    generateCI: string;
    generatingConfig: string;
    configCreated: string;
    initSuccess: string;
    createdFiles: string;
    nextSteps: string;
    setEnvVar: string;
    initFailed: string;

    // Analyze command
    loadingConfig: string;
    readingFiles: string;
    noFilesFound: string;
    checkSourcePath: string;
    analyzingFiles: string;
    analysisComplete: string;
    analysisSummary: string;
    filesAnalyzed: string;
    errors: string;
    totalExports: string;
    totalFunctions: string;
    totalClasses: string;
    totalComponents: string;
    resultsSaved: string;
    runVerbose: string;
    analysisFailed: string;

    // Generate command
    loadingAnalysis: string;
    analysisNotFound: string;
    runAnalyzeFirst: string;
    noResults: string;
    noResultsInFile: string;
    creatingOutputDir: string;
    generatingDocs: string;
    generatingIndex: string;
    generationComplete: string;
    generationSummary: string;
    totalPages: string;
    outputDirectory: string;
    indexPage: string;
    apiIndex: string;
    totalSize: string;
    previewHint: string;
    buildHint: string;
    generationFailed: string;

    // Build command
    buildTitle: string;
    skippingAnalysis: string;
    skippingGeneration: string;
    buildingSite: string;
    buildingVite: string;
    buildComplete: string;
    deployHint: string;
    previewLocalHint: string;
    buildFailed: string;

    // Serve command
    serverTitle: string;
    analyzingSource: string;
    generatingDocumentation: string;
    startingVite: string;
    serverStarted: string;
    localServer: string;
    pressCtrlC: string;
    serverFailed: string;
    shuttingDown: string;

    // Dev command
    devTitle: string;
    devMode: string;
    watchingFiles: string;
    fileChanged: string;
    reanalyzing: string;
    hotReloadActive: string;

    // Detect
    languages: string;
    frameworks: string;
    suggestedParsers: string;
    sourcePath: string;
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
  cli: {
    appDescription: 'AI-powered code documentation generator',
    configNotFound: 'Configuration file not found',
    runInitFirst: 'Run "codedocs init" to create a configuration file',
    initTitle: 'CodeDocs Initialization',
    detectingStack: 'Detecting project stack...',
    stackDetected: 'Stack detection complete!',
    stackDetectFailed: 'Stack detection failed, using defaults',
    projectName: 'Project name:',
    projectNameRequired: 'Project name is required',
    sourceCodePath: 'Source code path:',
    primaryLanguage: 'Primary language/framework:',
    selectParsers: 'Select parsers to use:',
    aiProvider: 'AI provider for documentation generation:',
    aiModel: 'AI model:',
    apiKeyPrompt: 'API key (leave empty to set via environment variable):',
    docLanguage: 'Documentation language:',
    deployTarget: 'Deployment target:',
    generateCI: 'Generate CI/CD pipeline configuration?',
    generatingConfig: 'Generating configuration...',
    configCreated: 'Configuration created successfully!',
    initSuccess: 'CodeDocs initialized successfully!',
    createdFiles: 'Created files:',
    nextSteps: 'Next steps:',
    setEnvVar: 'Set {envVar} environment variable',
    initFailed: 'Failed to create configuration',
    loadingConfig: 'Loading configuration...',
    readingFiles: 'Reading source files...',
    noFilesFound: 'No source files found',
    checkSourcePath: 'Check your source path in the config file',
    analyzingFiles: 'Analyzing {n} files...',
    analysisComplete: 'Analysis complete!',
    analysisSummary: 'Analysis Summary:',
    filesAnalyzed: 'Files analyzed: {success}/{total}',
    errors: 'Errors: {n}',
    totalExports: 'Total exports: {n}',
    totalFunctions: 'Total functions: {n}',
    totalClasses: 'Total classes: {n}',
    totalComponents: 'Total components: {n}',
    resultsSaved: 'Results saved to: {path}',
    runVerbose: 'Run with --verbose to see detailed error messages',
    analysisFailed: 'Analysis failed',
    loadingAnalysis: 'Loading analysis results...',
    analysisNotFound: 'Analysis results not found',
    runAnalyzeFirst: 'Run "codedocs analyze" first',
    noResults: 'No analysis results to generate from',
    noResultsInFile: 'No results found in analysis file',
    creatingOutputDir: 'Creating output directory...',
    generatingDocs: 'Generating documentation...',
    generatingIndex: 'Generating index page...',
    generationComplete: 'Documentation generated!',
    generationSummary: 'Generation Summary:',
    totalPages: 'Total pages generated: {n}',
    outputDirectory: 'Output directory: {dir}',
    indexPage: 'Index page: {path}',
    apiIndex: 'API index: {path}',
    totalSize: 'Total size: {size}',
    previewHint: 'Run "codedocs serve" to preview',
    buildHint: 'Run "codedocs build" to create production build',
    generationFailed: 'Generation failed',
    buildTitle: 'Building Documentation',
    skippingAnalysis: 'Skipping analysis step',
    skippingGeneration: 'Skipping generation step',
    buildingSite: 'Building static site...',
    buildingVite: 'Building with Vite...',
    buildComplete: 'Build Complete!',
    deployHint: 'Deploy the {dir} directory to your hosting service',
    previewLocalHint: 'Or preview locally with a static file server',
    buildFailed: 'Build failed',
    serverTitle: 'Starting Development Server',
    analyzingSource: 'Analyzing source code...',
    generatingDocumentation: 'Generating documentation...',
    startingVite: 'Starting Vite dev server...',
    serverStarted: 'Server started successfully!',
    localServer: 'Local server:',
    pressCtrlC: 'Press Ctrl+C to stop the server',
    serverFailed: 'Server failed to start',
    shuttingDown: 'Shutting down server...',
    devTitle: 'Starting Development Mode',
    devMode: 'Development mode with hot reload',
    watchingFiles: 'Watching for file changes...',
    fileChanged: 'File changed',
    reanalyzing: 'Re-analyzing and regenerating...',
    hotReloadActive: 'Hot reload is active',
    languages: 'Languages:',
    frameworks: 'Frameworks:',
    suggestedParsers: 'Suggested parsers:',
    sourcePath: 'Source path: {path}',
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
  cli: {
    appDescription: 'AI 기반 코드 문서 생성기',
    configNotFound: '설정 파일을 찾을 수 없습니다',
    runInitFirst: '"codedocs init"을 실행하여 설정 파일을 생성하세요',
    initTitle: 'CodeDocs 초기화',
    detectingStack: '프로젝트 스택 감지 중...',
    stackDetected: '스택 감지 완료!',
    stackDetectFailed: '스택 감지 실패, 기본값 사용',
    projectName: '프로젝트 이름:',
    projectNameRequired: '프로젝트 이름은 필수입니다',
    sourceCodePath: '소스 코드 경로:',
    primaryLanguage: '주요 언어/프레임워크:',
    selectParsers: '사용할 파서 선택:',
    aiProvider: '문서 생성 AI 제공자:',
    aiModel: 'AI 모델:',
    apiKeyPrompt: 'API 키 (환경 변수로 설정하려면 비워두세요):',
    docLanguage: '문서 언어:',
    deployTarget: '배포 대상:',
    generateCI: 'CI/CD 파이프라인 설정을 생성하시겠습니까?',
    generatingConfig: '설정 생성 중...',
    configCreated: '설정이 성공적으로 생성되었습니다!',
    initSuccess: 'CodeDocs 초기화 완료!',
    createdFiles: '생성된 파일:',
    nextSteps: '다음 단계:',
    setEnvVar: '{envVar} 환경 변수를 설정하세요',
    initFailed: '설정 생성 실패',
    loadingConfig: '설정 로드 중...',
    readingFiles: '소스 파일 읽는 중...',
    noFilesFound: '소스 파일을 찾을 수 없습니다',
    checkSourcePath: '설정 파일의 소스 경로를 확인하세요',
    analyzingFiles: '{n}개 파일 분석 중...',
    analysisComplete: '분석 완료!',
    analysisSummary: '분석 요약:',
    filesAnalyzed: '분석된 파일: {success}/{total}',
    errors: '오류: {n}',
    totalExports: '총 내보내기: {n}',
    totalFunctions: '총 함수: {n}',
    totalClasses: '총 클래스: {n}',
    totalComponents: '총 컴포넌트: {n}',
    resultsSaved: '결과 저장 위치: {path}',
    runVerbose: '--verbose 옵션으로 자세한 오류 메시지를 확인하세요',
    analysisFailed: '분석 실패',
    loadingAnalysis: '분석 결과 로드 중...',
    analysisNotFound: '분석 결과를 찾을 수 없습니다',
    runAnalyzeFirst: '"codedocs analyze"를 먼저 실행하세요',
    noResults: '생성할 분석 결과가 없습니다',
    noResultsInFile: '분석 파일에 결과가 없습니다',
    creatingOutputDir: '출력 디렉토리 생성 중...',
    generatingDocs: '문서 생성 중...',
    generatingIndex: '인덱스 페이지 생성 중...',
    generationComplete: '문서 생성 완료!',
    generationSummary: '생성 요약:',
    totalPages: '총 생성 페이지: {n}',
    outputDirectory: '출력 디렉토리: {dir}',
    indexPage: '인덱스 페이지: {path}',
    apiIndex: 'API 인덱스: {path}',
    totalSize: '총 크기: {size}',
    previewHint: '"codedocs serve"로 미리보기',
    buildHint: '"codedocs build"로 프로덕션 빌드',
    generationFailed: '생성 실패',
    buildTitle: '문서 빌드',
    skippingAnalysis: '분석 단계 건너뛰기',
    skippingGeneration: '생성 단계 건너뛰기',
    buildingSite: '정적 사이트 빌드 중...',
    buildingVite: 'Vite로 빌드 중...',
    buildComplete: '빌드 완료!',
    deployHint: '{dir} 디렉토리를 호스팅 서비스에 배포하세요',
    previewLocalHint: '또는 정적 파일 서버로 로컬 미리보기',
    buildFailed: '빌드 실패',
    serverTitle: '개발 서버 시작',
    analyzingSource: '소스 코드 분석 중...',
    generatingDocumentation: '문서 생성 중...',
    startingVite: 'Vite 개발 서버 시작 중...',
    serverStarted: '서버가 성공적으로 시작되었습니다!',
    localServer: '로컬 서버:',
    pressCtrlC: 'Ctrl+C로 서버 종료',
    serverFailed: '서버 시작 실패',
    shuttingDown: '서버 종료 중...',
    devTitle: '개발 모드 시작',
    devMode: '핫 리로드 개발 모드',
    watchingFiles: '파일 변경 감지 중...',
    fileChanged: '파일 변경됨',
    reanalyzing: '재분석 및 재생성 중...',
    hotReloadActive: '핫 리로드 활성화',
    languages: '언어:',
    frameworks: '프레임워크:',
    suggestedParsers: '추천 파서:',
    sourcePath: '소스 경로: {path}',
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
  cli: {
    appDescription: 'AI搭載コードドキュメントジェネレーター',
    configNotFound: '設定ファイルが見つかりません',
    runInitFirst: '"codedocs init"を実行して設定ファイルを作成してください',
    initTitle: 'CodeDocs 初期化',
    detectingStack: 'プロジェクトスタック検出中...',
    stackDetected: 'スタック検出完了！',
    stackDetectFailed: 'スタック検出失敗、デフォルトを使用',
    projectName: 'プロジェクト名:',
    projectNameRequired: 'プロジェクト名は必須です',
    sourceCodePath: 'ソースコードパス:',
    primaryLanguage: '主要言語/フレームワーク:',
    selectParsers: '使用するパーサーを選択:',
    aiProvider: 'ドキュメント生成AIプロバイダー:',
    aiModel: 'AIモデル:',
    apiKeyPrompt: 'APIキー (環境変数で設定する場合は空欄):',
    docLanguage: 'ドキュメント言語:',
    deployTarget: 'デプロイ先:',
    generateCI: 'CI/CDパイプライン設定を生成しますか？',
    generatingConfig: '設定を生成中...',
    configCreated: '設定の作成に成功しました！',
    initSuccess: 'CodeDocs初期化完了！',
    createdFiles: '作成されたファイル:',
    nextSteps: '次のステップ:',
    setEnvVar: '{envVar}環境変数を設定してください',
    initFailed: '設定の作成に失敗しました',
    loadingConfig: '設定を読み込み中...',
    readingFiles: 'ソースファイル読み込み中...',
    noFilesFound: 'ソースファイルが見つかりません',
    checkSourcePath: '設定ファイルのソースパスを確認してください',
    analyzingFiles: '{n}ファイルを分析中...',
    analysisComplete: '分析完了！',
    analysisSummary: '分析サマリー:',
    filesAnalyzed: '分析ファイル: {success}/{total}',
    errors: 'エラー: {n}',
    totalExports: '総エクスポート: {n}',
    totalFunctions: '総関数: {n}',
    totalClasses: '総クラス: {n}',
    totalComponents: '総コンポーネント: {n}',
    resultsSaved: '結果の保存先: {path}',
    runVerbose: '--verboseで詳細なエラーメッセージを確認できます',
    analysisFailed: '分析失敗',
    loadingAnalysis: '分析結果を読み込み中...',
    analysisNotFound: '分析結果が見つかりません',
    runAnalyzeFirst: '先に"codedocs analyze"を実行してください',
    noResults: '生成する分析結果がありません',
    noResultsInFile: '分析ファイルに結果がありません',
    creatingOutputDir: '出力ディレクトリを作成中...',
    generatingDocs: 'ドキュメント生成中...',
    generatingIndex: 'インデックスページ生成中...',
    generationComplete: 'ドキュメント生成完了！',
    generationSummary: '生成サマリー:',
    totalPages: '総生成ページ: {n}',
    outputDirectory: '出力ディレクトリ: {dir}',
    indexPage: 'インデックスページ: {path}',
    apiIndex: 'APIインデックス: {path}',
    totalSize: '総サイズ: {size}',
    previewHint: '"codedocs serve"でプレビュー',
    buildHint: '"codedocs build"でプロダクションビルド',
    generationFailed: '生成失敗',
    buildTitle: 'ドキュメントビルド',
    skippingAnalysis: '分析ステップをスキップ',
    skippingGeneration: '生成ステップをスキップ',
    buildingSite: '静的サイトをビルド中...',
    buildingVite: 'Viteでビルド中...',
    buildComplete: 'ビルド完了！',
    deployHint: '{dir}ディレクトリをホスティングサービスにデプロイしてください',
    previewLocalHint: 'または静的ファイルサーバーでローカルプレビュー',
    buildFailed: 'ビルド失敗',
    serverTitle: '開発サーバー起動',
    analyzingSource: 'ソースコード分析中...',
    generatingDocumentation: 'ドキュメント生成中...',
    startingVite: 'Vite開発サーバー起動中...',
    serverStarted: 'サーバーが正常に起動しました！',
    localServer: 'ローカルサーバー:',
    pressCtrlC: 'Ctrl+Cでサーバー停止',
    serverFailed: 'サーバーの起動に失敗しました',
    shuttingDown: 'サーバー終了中...',
    devTitle: '開発モード起動',
    devMode: 'ホットリロード開発モード',
    watchingFiles: 'ファイル変更監視中...',
    fileChanged: 'ファイル変更',
    reanalyzing: '再分析・再生成中...',
    hotReloadActive: 'ホットリロード有効',
    languages: '言語:',
    frameworks: 'フレームワーク:',
    suggestedParsers: '推奨パーサー:',
    sourcePath: 'ソースパス: {path}',
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
  cli: {
    appDescription: 'AI驱动的代码文档生成器',
    configNotFound: '未找到配置文件',
    runInitFirst: '运行 "codedocs init" 创建配置文件',
    initTitle: 'CodeDocs 初始化',
    detectingStack: '正在检测项目技术栈...',
    stackDetected: '技术栈检测完成！',
    stackDetectFailed: '技术栈检测失败，使用默认值',
    projectName: '项目名称:',
    projectNameRequired: '项目名称为必填项',
    sourceCodePath: '源代码路径:',
    primaryLanguage: '主要语言/框架:',
    selectParsers: '选择要使用的解析器:',
    aiProvider: '文档生成AI提供商:',
    aiModel: 'AI模型:',
    apiKeyPrompt: 'API密钥 (留空以通过环境变量设置):',
    docLanguage: '文档语言:',
    deployTarget: '部署目标:',
    generateCI: '是否生成CI/CD管道配置？',
    generatingConfig: '正在生成配置...',
    configCreated: '配置创建成功！',
    initSuccess: 'CodeDocs初始化成功！',
    createdFiles: '已创建文件:',
    nextSteps: '下一步:',
    setEnvVar: '设置 {envVar} 环境变量',
    initFailed: '配置创建失败',
    loadingConfig: '正在加载配置...',
    readingFiles: '正在读取源文件...',
    noFilesFound: '未找到源文件',
    checkSourcePath: '请检查配置文件中的源路径',
    analyzingFiles: '正在分析 {n} 个文件...',
    analysisComplete: '分析完成！',
    analysisSummary: '分析摘要:',
    filesAnalyzed: '已分析文件: {success}/{total}',
    errors: '错误: {n}',
    totalExports: '总导出: {n}',
    totalFunctions: '总函数: {n}',
    totalClasses: '总类: {n}',
    totalComponents: '总组件: {n}',
    resultsSaved: '结果保存至: {path}',
    runVerbose: '使用 --verbose 查看详细错误信息',
    analysisFailed: '分析失败',
    loadingAnalysis: '正在加载分析结果...',
    analysisNotFound: '未找到分析结果',
    runAnalyzeFirst: '请先运行 "codedocs analyze"',
    noResults: '没有可生成的分析结果',
    noResultsInFile: '分析文件中没有结果',
    creatingOutputDir: '正在创建输出目录...',
    generatingDocs: '正在生成文档...',
    generatingIndex: '正在生成索引页...',
    generationComplete: '文档生成完成！',
    generationSummary: '生成摘要:',
    totalPages: '总生成页面: {n}',
    outputDirectory: '输出目录: {dir}',
    indexPage: '索引页: {path}',
    apiIndex: 'API索引: {path}',
    totalSize: '总大小: {size}',
    previewHint: '运行 "codedocs serve" 预览',
    buildHint: '运行 "codedocs build" 创建生产构建',
    generationFailed: '生成失败',
    buildTitle: '文档构建',
    skippingAnalysis: '跳过分析步骤',
    skippingGeneration: '跳过生成步骤',
    buildingSite: '正在构建静态站点...',
    buildingVite: '正在使用Vite构建...',
    buildComplete: '构建完成！',
    deployHint: '将 {dir} 目录部署到托管服务',
    previewLocalHint: '或使用静态文件服务器本地预览',
    buildFailed: '构建失败',
    serverTitle: '启动开发服务器',
    analyzingSource: '正在分析源代码...',
    generatingDocumentation: '正在生成文档...',
    startingVite: '正在启动Vite开发服务器...',
    serverStarted: '服务器启动成功！',
    localServer: '本地服务器:',
    pressCtrlC: '按 Ctrl+C 停止服务器',
    serverFailed: '服务器启动失败',
    shuttingDown: '正在关闭服务器...',
    devTitle: '启动开发模式',
    devMode: '热重载开发模式',
    watchingFiles: '正在监视文件变化...',
    fileChanged: '文件已更改',
    reanalyzing: '正在重新分析和生成...',
    hotReloadActive: '热重载已激活',
    languages: '语言:',
    frameworks: '框架:',
    suggestedParsers: '推荐解析器:',
    sourcePath: '源路径: {path}',
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
