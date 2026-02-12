import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { FileReader, ParserEngine, MarkdownGenerator, SidebarGenerator } from '@codedocs/core';
import type { SourceFile, AnalysisResult, GeneratorConfig } from '@codedocs/core';
import { nestjsParser } from '../../../parsers/typescript-nestjs/src/parser.js';
import { javaSpringParser } from '../../../parsers/java-spring/src/parser.js';
import { openApiParser } from '../../../parsers/openapi/src/parser.js';
import { detectStack } from '../detect.js';

// ─── Fixtures ────────────────────────────────────────────────────────

const NESTJS_CONTROLLER = `
import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(): User[] {
    return this.userService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto): User {
    return this.userService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): User {
    return this.userService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string): void {
    return this.userService.remove(id);
  }
}`;

const NESTJS_ENTITY = `
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_name', nullable: false })
  name: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}`;

const NESTJS_SERVICE = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
  ) {}

  findAll(): User[] {
    return this.userRepository.find();
  }

  create(dto: CreateUserDto): User {
    const user = this.userRepository.create(dto);
    this.notificationService.sendWelcome(user);
    return user;
  }

  findOne(id: string): User {
    return this.userRepository.findOneOrFail(id);
  }

  remove(id: string): void {
    this.userRepository.delete(id);
  }
}`;

const NESTJS_DTO = `
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

export class UserResponseDto {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}`;

const JAVA_CONTROLLER = `
@RestController
@RequestMapping("/api/orders")
public class OrderController {
    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public List<Order> getAll() {
        return orderService.findAll();
    }

    @PostMapping
    public ResponseEntity<Order> create(@RequestBody CreateOrderRequest request) {
        return ResponseEntity.ok(orderService.create(request));
    }

    @GetMapping("/{id}")
    public Order getById(@PathVariable Long id) {
        return orderService.findById(id);
    }
}`;

const JAVA_ENTITY = `
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true)
    private String orderNumber;

    @Column(precision = 10, scale = 2)
    private Double totalAmount;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
}`;

const OPENAPI_SPEC = `{
  "openapi": "3.0.0",
  "info": {
    "title": "Pet Store API",
    "version": "1.0.0",
    "description": "A sample Pet Store API"
  },
  "paths": {
    "/pets": {
      "get": {
        "operationId": "listPets",
        "summary": "List all pets",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "required": false,
            "schema": { "type": "integer" }
          }
        ],
        "responses": {
          "200": {
            "description": "A list of pets",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": { "$ref": "#/components/schemas/Pet" }
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createPet",
        "summary": "Create a pet",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": { "$ref": "#/components/schemas/Pet" }
            }
          }
        },
        "responses": {
          "201": { "description": "Pet created" }
        }
      }
    },
    "/pets/{petId}": {
      "get": {
        "operationId": "getPet",
        "summary": "Get a pet by ID",
        "parameters": [
          {
            "name": "petId",
            "in": "path",
            "required": true,
            "schema": { "type": "string" }
          }
        ],
        "responses": {
          "200": {
            "description": "A single pet"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Pet": {
        "type": "object",
        "required": ["name"],
        "properties": {
          "id": { "type": "integer", "format": "int64" },
          "name": { "type": "string" },
          "tag": { "type": "string" }
        }
      }
    }
  }
}`;

// ─── Helpers ─────────────────────────────────────────────────────────

let testDir: string;

function setupTestDir(): string {
  const dir = join(tmpdir(), `codedocs-integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createSourceFile(path: string, content: string): SourceFile {
  return { path, content, language: path.endsWith('.java') ? 'java' : 'typescript' };
}

function createAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      sourceDir: '/test/src',
      parsers: ['test-parser'],
      projectName: 'test-project',
      version: '1.0.0',
    },
    summary: {
      totalFiles: 4,
      endpoints: 3,
      entities: 1,
      services: 1,
      types: 2,
    },
    endpoints: [
      {
        name: 'findAll',
        protocol: 'rest',
        httpMethod: 'GET',
        path: '/users',
        handler: 'findAll',
        handlerClass: 'UserController',
        returnType: 'User[]',
        parameters: [],
        filePath: 'user.controller.ts',
      },
      {
        name: 'create',
        protocol: 'rest',
        httpMethod: 'POST',
        path: '/users',
        handler: 'create',
        handlerClass: 'UserController',
        returnType: 'User',
        parameters: [
          { name: 'dto', type: 'CreateUserDto', required: true, location: 'body' },
        ],
        filePath: 'user.controller.ts',
      },
      {
        name: 'findOne',
        protocol: 'rest',
        httpMethod: 'GET',
        path: '/users/:id',
        handler: 'findOne',
        handlerClass: 'UserController',
        returnType: 'User',
        parameters: [
          { name: 'id', type: 'string', required: true, location: 'path' },
        ],
        filePath: 'user.controller.ts',
      },
    ],
    entities: [
      {
        name: 'User',
        tableName: 'users',
        dbType: 'PostgreSQL',
        columns: [
          { name: 'id', type: 'number', dbColumnName: 'id', nullable: false, primaryKey: true, unique: false },
          { name: 'name', type: 'string', dbColumnName: 'user_name', nullable: false, primaryKey: false, unique: false },
          { name: 'email', type: 'string', dbColumnName: 'email', nullable: false, primaryKey: false, unique: true },
        ],
        relations: [
          { type: 'OneToMany', target: 'Post' },
        ],
        indexes: [],
        filePath: 'user.entity.ts',
      },
    ],
    services: [
      {
        name: 'UserService',
        filePath: 'user.service.ts',
        methods: ['findAll', 'create', 'findOne', 'remove'],
        dependencies: ['UserRepository', 'NotificationService'],
      },
    ],
    types: [
      {
        name: 'CreateUserDto',
        kind: 'input',
        fields: [
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
        ],
        filePath: 'user.dto.ts',
      },
      {
        name: 'UserResponseDto',
        kind: 'response',
        fields: [
          { name: 'id', type: 'number', required: true },
          { name: 'name', type: 'string', required: true },
          { name: 'email', type: 'string', required: true },
        ],
        filePath: 'user.dto.ts',
      },
    ],
    dependencies: [
      { source: 'UserController', target: 'UserService', type: 'inject' },
      { source: 'UserService', target: 'UserRepository', type: 'inject' },
    ],
    custom: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Integration: Stack Detection', () => {
  beforeEach(() => {
    testDir = setupTestDir();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('detects NestJS + TypeORM project', async () => {
    // Set up a mock NestJS project
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({
      dependencies: {
        '@nestjs/core': '^10.0.0',
        'typeorm': '^0.3.0',
        'react': '^18.0.0',
      },
    }));
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'app.ts'), 'export class App {}');

    const result = await detectStack(testDir);

    expect(result.languages.length).toBeGreaterThan(0);
    expect(result.frameworks.some(f => f.name === 'NestJS')).toBe(true);
    expect(result.frameworks.some(f => f.name === 'TypeORM')).toBe(true);
    expect(result.suggestedParsers.some(p => p.package === '@codedocs/parser-typescript-nestjs')).toBe(true);
    expect(result.sourcePath).toBe('./src');
  });

  it('detects Java Spring Boot project', async () => {
    writeFileSync(join(testDir, 'build.gradle'), `
      plugins { id 'org.springframework.boot' version '3.0.0' }
      dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }
    `);
    mkdirSync(join(testDir, 'src/main/java'), { recursive: true });
    writeFileSync(join(testDir, 'src/main/java/App.java'), 'public class App {}');

    const result = await detectStack(testDir);

    expect(result.frameworks.some(f => f.name === 'Java Spring Boot')).toBe(true);
    expect(result.suggestedParsers.some(p => p.package === '@codedocs/parser-java-spring')).toBe(true);
    // inferSourcePath finds 'src' first (it's the parent dir containing main/)
    expect(result.sourcePath).toBe('./src');
  });

  it('detects OpenAPI spec project', async () => {
    writeFileSync(join(testDir, 'openapi.json'), OPENAPI_SPEC);
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ dependencies: {} }));
    mkdirSync(join(testDir, 'src'), { recursive: true });
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export {}');

    const result = await detectStack(testDir);

    expect(result.frameworks.some(f => f.name === 'OpenAPI')).toBe(true);
  });

  it('detects FastAPI project', async () => {
    writeFileSync(join(testDir, 'requirements.txt'), 'fastapi==0.100.0\nsqlalchemy==2.0.0\nuvicorn');
    mkdirSync(join(testDir, 'app'), { recursive: true });
    writeFileSync(join(testDir, 'app', 'main.py'), 'from fastapi import FastAPI');

    const result = await detectStack(testDir);

    expect(result.frameworks.some(f => f.name === 'FastAPI')).toBe(true);
    expect(result.frameworks.some(f => f.name === 'SQLAlchemy')).toBe(true);
    expect(result.suggestedParsers.some(p => p.package === '@codedocs/parser-python-fastapi')).toBe(true);
    expect(result.sourcePath).toBe('./app');
  });

  it('detects build tools', async () => {
    writeFileSync(join(testDir, 'package.json'), '{}');
    writeFileSync(join(testDir, 'turbo.json'), '{}');
    mkdirSync(join(testDir, 'src'));

    const result = await detectStack(testDir);

    expect(result.buildTools).toContain('npm');
    expect(result.buildTools).toContain('Turborepo');
  });
});

describe('Integration: Analyze Pipeline', () => {
  it('NestJS: source files → ParserEngine → AnalysisResult', async () => {
    const parser = nestjsParser();
    const engine = new ParserEngine([parser]);

    const files: SourceFile[] = [
      createSourceFile('src/user.controller.ts', NESTJS_CONTROLLER),
      createSourceFile('src/user.entity.ts', NESTJS_ENTITY),
      createSourceFile('src/user.service.ts', NESTJS_SERVICE),
      createSourceFile('src/user.dto.ts', NESTJS_DTO),
    ];

    const result = await engine.analyze(files);

    // Metadata
    expect(result.metadata.parsers).toContain('typescript-nestjs');
    expect(result.summary.totalFiles).toBe(4);

    // Endpoints: at least 3 REST endpoints from controller
    expect(result.endpoints.length).toBeGreaterThanOrEqual(3);
    const getAll = result.endpoints.find(e => e.httpMethod === 'GET' && e.path === '/users');
    expect(getAll).toBeDefined();
    expect(getAll!.handlerClass).toBe('UserController');

    const post = result.endpoints.find(e => e.httpMethod === 'POST');
    expect(post).toBeDefined();

    // Entities: User entity with columns and relations
    expect(result.entities.length).toBeGreaterThanOrEqual(1);
    const userEntity = result.entities.find(e => e.name === 'User');
    expect(userEntity).toBeDefined();
    expect(userEntity!.tableName).toBe('users');
    expect(userEntity!.columns.length).toBeGreaterThanOrEqual(3);
    expect(userEntity!.relations.length).toBeGreaterThanOrEqual(1);

    // Services
    expect(result.services.length).toBeGreaterThanOrEqual(1);
    const userService = result.services.find(s => s.name === 'UserService');
    expect(userService).toBeDefined();
    expect(userService!.dependencies).toContain('UserRepository');

    // Types (DTOs)
    expect(result.types.length).toBeGreaterThanOrEqual(2);
  });

  it('Java Spring: source files → ParserEngine → AnalysisResult', async () => {
    const parser = javaSpringParser();
    const engine = new ParserEngine([parser]);

    const files: SourceFile[] = [
      createSourceFile('src/OrderController.java', JAVA_CONTROLLER),
      createSourceFile('src/Order.java', JAVA_ENTITY),
    ];

    const result = await engine.analyze(files);

    expect(result.metadata.parsers).toContain('java-spring');
    expect(result.summary.totalFiles).toBe(2);

    // Endpoints
    expect(result.endpoints.length).toBeGreaterThanOrEqual(2);
    const getAll = result.endpoints.find(e => e.httpMethod === 'GET' && !e.path.includes('{'));
    expect(getAll).toBeDefined();

    // Entities
    expect(result.entities.length).toBe(1);
    expect(result.entities[0].name).toBe('Order');
    expect(result.entities[0].tableName).toBe('orders');
  });

  it('OpenAPI: spec → ParserEngine → AnalysisResult', async () => {
    const parser = openApiParser();
    const engine = new ParserEngine([parser]);

    const files: SourceFile[] = [
      createSourceFile('openapi.json', OPENAPI_SPEC),
    ];

    const result = await engine.analyze(files);

    expect(result.metadata.parsers).toContain('openapi');

    // Should parse endpoints from spec
    expect(result.endpoints.length).toBeGreaterThanOrEqual(2);
    const listPets = result.endpoints.find(e => e.path?.includes('/pets') && e.httpMethod === 'GET' && !e.path.includes('{'));
    expect(listPets).toBeDefined();

    const createPet = result.endpoints.find(e => e.httpMethod === 'POST');
    expect(createPet).toBeDefined();
  });

  it('Multi-parser: NestJS + Java files with appropriate parsers', async () => {
    const nestjs = nestjsParser();
    const java = javaSpringParser();
    const engine = new ParserEngine([nestjs, java]);

    const files: SourceFile[] = [
      createSourceFile('src/user.controller.ts', NESTJS_CONTROLLER),
      createSourceFile('src/OrderController.java', JAVA_CONTROLLER),
    ];

    const result = await engine.analyze(files);

    // Both parsers should contribute
    expect(result.metadata.parsers).toContain('typescript-nestjs');
    expect(result.metadata.parsers).toContain('java-spring');

    // Merged endpoints from both parsers
    expect(result.endpoints.length).toBeGreaterThanOrEqual(5);

    // Should have endpoints from both controllers
    const userEndpoints = result.endpoints.filter(e => e.handlerClass === 'UserController');
    const orderEndpoints = result.endpoints.filter(e => e.handlerClass === 'OrderController');
    expect(userEndpoints.length).toBeGreaterThanOrEqual(2);
    expect(orderEndpoints.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Integration: Generate Pipeline', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = setupTestDir();
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  it('AnalysisResult → MarkdownGenerator → pages', async () => {
    const analysis = createAnalysisResult();

    const config: GeneratorConfig = {
      outputDir,
      locale: 'en',
      sections: [
        { id: 'overview', label: 'Overview', type: 'auto' },
        { id: 'api', label: 'API', type: 'endpoints' },
        { id: 'entities', label: 'Data Models', type: 'entities' },
        { id: 'architecture', label: 'Architecture', type: 'architecture' },
        { id: 'changelog', label: 'Changelog', type: 'changelog' },
      ],
    };

    const generator = new MarkdownGenerator(config);
    const pages = await generator.generate(analysis);

    // Should generate multiple pages
    expect(pages.length).toBeGreaterThanOrEqual(5);

    // Overview page
    const overview = pages.find(p => p.path === 'overview.md');
    expect(overview).toBeDefined();
    expect(overview!.content).toContain('test-project');
    expect(overview!.content).toContain('---'); // frontmatter

    // API endpoint pages
    const apiPages = pages.filter(p => p.path.startsWith('api/'));
    expect(apiPages.length).toBeGreaterThanOrEqual(1);
    const userApi = apiPages.find(p => p.path.includes('user-controller'));
    expect(userApi).toBeDefined();
    expect(userApi!.content).toContain('GET');
    expect(userApi!.content).toContain('POST');
    expect(userApi!.content).toContain('/users');

    // Entity pages (auto + entities sections both generate entity pages)
    const entityPages = pages.filter(p => p.path.startsWith('entities/'));
    expect(entityPages.length).toBeGreaterThanOrEqual(1);
    const userEntity = entityPages[0];
    expect(userEntity.content).toContain('User');
    expect(userEntity.content).toContain('users'); // table name
    expect(userEntity.content).toContain('PostgreSQL');
    expect(userEntity.content).toContain('OneToMany');
    expect(userEntity.content).toContain('mermaid'); // ER diagram

    // Architecture page
    const arch = pages.find(p => p.path === 'architecture.md');
    expect(arch).toBeDefined();
    expect(arch!.content).toContain('UserService');
    expect(arch!.content).toContain('mermaid'); // dependency graph

    // Changelog page
    const changelog = pages.find(p => p.path === 'changelog.md');
    expect(changelog).toBeDefined();
  });

  it('generates frontmatter with YAML format on every page', async () => {
    const analysis = createAnalysisResult();
    const config: GeneratorConfig = {
      outputDir,
      locale: 'en',
      sections: [{ id: 'api', label: 'API', type: 'endpoints' }],
    };

    const generator = new MarkdownGenerator(config);
    const pages = await generator.generate(analysis);

    for (const page of pages) {
      expect(page.content.startsWith('---\n')).toBe(true);
      expect(page.content).toMatch(/title: ".+"/);
    }
  });

  it('applies page overrides from config', async () => {
    const analysis = createAnalysisResult();
    const config: GeneratorConfig = {
      outputDir,
      locale: 'en',
      sections: [{ id: 'api', label: 'API', type: 'endpoints' }],
      pageOverrides: {
        'api/user-controller.md': {
          title: 'Custom User API Title',
          description: 'Custom description for user API',
          tags: ['api', 'users'],
        },
      },
    };

    const generator = new MarkdownGenerator(config);
    const pages = await generator.generate(analysis);

    const userApi = pages.find(p => p.path === 'api/user-controller.md');
    expect(userApi).toBeDefined();
    expect(userApi!.title).toBe('Custom User API Title');
    expect(userApi!.content).toContain('Custom User API Title');
    expect(userApi!.content).toContain('Custom description for user API');
    expect(userApi!.content).toContain('"api"');
  });

  it('generates sidebar from generated pages', async () => {
    // Use analysis with multiple handler classes so API becomes a category
    const analysis = createAnalysisResult({
      endpoints: [
        ...createAnalysisResult().endpoints,
        {
          name: 'listOrders',
          protocol: 'rest',
          httpMethod: 'GET',
          path: '/orders',
          handler: 'listOrders',
          handlerClass: 'OrderController',
          returnType: 'Order[]',
          parameters: [],
          filePath: 'order.controller.ts',
        },
      ],
    });

    const sections = [
      { id: 'api', label: 'API', type: 'endpoints' as const },
      { id: 'entities', label: 'Data Models', type: 'entities' as const },
      { id: 'architecture', label: 'Architecture', type: 'architecture' as const },
    ];

    // First generate pages from analysis
    const generator = new MarkdownGenerator({
      outputDir,
      locale: 'en',
      sections,
    });
    const pages = await generator.generate(analysis);

    // Then generate sidebar from pages
    const sidebarGenerator = new SidebarGenerator();
    const sidebar = sidebarGenerator.generate(pages, sections);

    expect(sidebar.length).toBeGreaterThan(0);

    // API section has 2 handler classes → becomes a category
    const apiCategory = sidebar.find(s => s.label === 'API');
    expect(apiCategory).toBeDefined();
    expect(apiCategory!.type).toBe('category');
    expect(apiCategory!.items!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Integration: Full E2E Pipeline', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = setupTestDir();
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('NestJS: source files → analyze → generate → output files', async () => {
    // Step 1: Set up source files
    const srcDir = join(workDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'user.controller.ts'), NESTJS_CONTROLLER);
    writeFileSync(join(srcDir, 'user.entity.ts'), NESTJS_ENTITY);
    writeFileSync(join(srcDir, 'user.service.ts'), NESTJS_SERVICE);
    writeFileSync(join(srcDir, 'user.dto.ts'), NESTJS_DTO);

    // Step 2: Read source files (FileReader)
    const fileReader = new FileReader();
    const sourceFiles = await fileReader.readFiles(srcDir, ['**/*.ts']);

    expect(sourceFiles.length).toBe(4);
    expect(sourceFiles.every(f => f.language === 'typescript')).toBe(true);
    expect(sourceFiles.every(f => f.content.length > 0)).toBe(true);

    // Step 3: Analyze (ParserEngine)
    const parser = nestjsParser();
    const engine = new ParserEngine([parser]);
    const analysis = await engine.analyze(sourceFiles);

    expect(analysis.endpoints.length).toBeGreaterThanOrEqual(3);
    expect(analysis.entities.length).toBeGreaterThanOrEqual(1);
    expect(analysis.services.length).toBeGreaterThanOrEqual(1);
    expect(analysis.types.length).toBeGreaterThanOrEqual(2);

    // Step 4: Save analysis-result.json (simulating CLI analyze command)
    const analysisOutput = {
      timestamp: new Date().toISOString(),
      config: { name: 'Test Project', language: 'TypeScript', locale: 'en' },
      summary: {
        totalFiles: sourceFiles.length,
        successCount: sourceFiles.length,
        errorCount: 0,
        totalExports: analysis.summary.endpoints,
        totalFunctions: analysis.summary.services,
        totalClasses: analysis.summary.entities,
      },
      results: [analysis],
    };
    const analysisPath = join(workDir, 'analysis-result.json');
    writeFileSync(analysisPath, JSON.stringify(analysisOutput, null, 2));

    expect(existsSync(analysisPath)).toBe(true);
    const savedAnalysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    expect(savedAnalysis.results.length).toBe(1);
    expect(savedAnalysis.summary.totalFiles).toBe(4);

    // Step 5: Generate markdown docs (MarkdownGenerator)
    const docsDir = join(workDir, 'docs-output');
    mkdirSync(docsDir, { recursive: true });

    const generatorConfig: GeneratorConfig = {
      outputDir: docsDir,
      locale: 'en',
      sections: [
        { id: 'overview', label: 'Overview', type: 'auto' },
        { id: 'api', label: 'API', type: 'endpoints' },
        { id: 'entities', label: 'Data Models', type: 'entities' },
        { id: 'architecture', label: 'Architecture', type: 'architecture' },
        { id: 'changelog', label: 'Changelog', type: 'changelog' },
      ],
    };

    const generator = new MarkdownGenerator(generatorConfig);

    for (const result of savedAnalysis.results) {
      const pages = await generator.generate(result);

      // Write each page to disk
      for (const page of pages) {
        const filePath = join(docsDir, page.path);
        const dir = resolve(filePath, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, page.content, 'utf-8');
      }
    }

    // Step 6: Verify output files
    expect(existsSync(join(docsDir, 'overview.md'))).toBe(true);
    expect(existsSync(join(docsDir, 'architecture.md'))).toBe(true);
    expect(existsSync(join(docsDir, 'changelog.md'))).toBe(true);

    // Verify API docs
    const apiDir = join(docsDir, 'api');
    expect(existsSync(apiDir)).toBe(true);

    // Verify entity docs
    const entitiesDir = join(docsDir, 'entities');
    expect(existsSync(entitiesDir)).toBe(true);

    // Verify overview content references correct data
    const overviewContent = readFileSync(join(docsDir, 'overview.md'), 'utf-8');
    expect(overviewContent).toContain('Endpoints');
    expect(overviewContent).toContain('Entities');
    expect(overviewContent).toContain('Services');

    // Verify architecture has dependency graph
    const archContent = readFileSync(join(docsDir, 'architecture.md'), 'utf-8');
    expect(archContent).toContain('UserService');
    expect(archContent).toContain('UserRepository');
  });

  it('Java Spring: source files → analyze → generate → output files', async () => {
    const srcDir = join(workDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'OrderController.java'), JAVA_CONTROLLER);
    writeFileSync(join(srcDir, 'Order.java'), JAVA_ENTITY);

    // Read files
    const fileReader = new FileReader();
    const sourceFiles = await fileReader.readFiles(srcDir, ['**/*.java']);
    expect(sourceFiles.length).toBe(2);

    // Analyze
    const parser = javaSpringParser();
    const engine = new ParserEngine([parser]);
    const analysis = await engine.analyze(sourceFiles);

    expect(analysis.endpoints.length).toBeGreaterThanOrEqual(2);
    expect(analysis.entities.length).toBe(1);

    // Generate
    const docsDir = join(workDir, 'docs-output');
    mkdirSync(docsDir, { recursive: true });

    const generator = new MarkdownGenerator({
      outputDir: docsDir,
      locale: 'en',
      sections: [
        { id: 'api', label: 'API', type: 'endpoints' },
        { id: 'entities', label: 'Entities', type: 'entities' },
      ],
    });
    const pages = await generator.generate(analysis);

    for (const page of pages) {
      const filePath = join(docsDir, page.path);
      const dir = resolve(filePath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, page.content, 'utf-8');
    }

    // Verify
    expect(pages.length).toBeGreaterThanOrEqual(3); // overview + api + entity
    const entityPages = pages.filter(p => p.path.startsWith('entities/'));
    expect(entityPages.length).toBe(1);
    expect(entityPages[0].content).toContain('Order');
    expect(entityPages[0].content).toContain('orders');
  });

  it('OpenAPI: spec → analyze → generate → output files', async () => {
    mkdirSync(join(workDir, 'spec'), { recursive: true });
    writeFileSync(join(workDir, 'spec', 'openapi.json'), OPENAPI_SPEC);

    // Read files
    const fileReader = new FileReader();
    const sourceFiles = await fileReader.readFiles(join(workDir, 'spec'), ['**/*.json']);
    expect(sourceFiles.length).toBe(1);

    // Analyze
    const parser = openApiParser();
    const engine = new ParserEngine([parser]);
    const analysis = await engine.analyze(sourceFiles);

    expect(analysis.endpoints.length).toBeGreaterThanOrEqual(2);

    // Generate
    const docsDir = join(workDir, 'docs-output');
    mkdirSync(docsDir, { recursive: true });

    const generator = new MarkdownGenerator({
      outputDir: docsDir,
      locale: 'en',
      sections: [{ id: 'api', label: 'API', type: 'endpoints' }],
    });
    const pages = await generator.generate(analysis);

    expect(pages.length).toBeGreaterThanOrEqual(2); // overview + api pages
    const apiPages = pages.filter(p => p.path.startsWith('api/'));
    expect(apiPages.length).toBeGreaterThanOrEqual(1);

    // Check endpoint details in generated markdown
    const allContent = apiPages.map(p => p.content).join('\n');
    expect(allContent).toContain('GET');
    expect(allContent).toContain('POST');
  });

  it('FileReader respects glob patterns and ignores node_modules', async () => {
    const srcDir = join(workDir, 'src');
    mkdirSync(srcDir, { recursive: true });
    mkdirSync(join(workDir, 'node_modules/pkg'), { recursive: true });
    mkdirSync(join(workDir, 'dist'), { recursive: true });

    writeFileSync(join(srcDir, 'app.ts'), 'export const app = true;');
    writeFileSync(join(srcDir, 'util.js'), 'module.exports = {}');
    writeFileSync(join(workDir, 'node_modules/pkg/index.ts'), 'export {}');
    writeFileSync(join(workDir, 'dist', 'app.js'), 'var a = 1;');

    const fileReader = new FileReader();
    const files = await fileReader.readFiles(workDir, ['**/*.{ts,js}']);

    // Should include src files but exclude node_modules and dist
    const paths = files.map(f => f.path);
    expect(paths.some(p => p.includes('src/app.ts'))).toBe(true);
    expect(paths.some(p => p.includes('src/util.js'))).toBe(true);
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
    expect(paths.some(p => p.includes('dist'))).toBe(false);
  });

  it('handles empty source directory gracefully', async () => {
    const srcDir = join(workDir, 'empty-src');
    mkdirSync(srcDir, { recursive: true });

    const fileReader = new FileReader();
    const sourceFiles = await fileReader.readFiles(srcDir, ['**/*.ts']);
    expect(sourceFiles.length).toBe(0);

    const engine = new ParserEngine([nestjsParser()]);
    const analysis = await engine.analyze(sourceFiles);

    expect(analysis.endpoints).toEqual([]);
    expect(analysis.entities).toEqual([]);
    expect(analysis.services).toEqual([]);
    expect(analysis.summary.totalFiles).toBe(0);
  });

  it('multi-locale generation produces locale-appropriate output', async () => {
    const analysis = createAnalysisResult();

    for (const locale of ['en', 'ko', 'ja', 'zh'] as const) {
      const generator = new MarkdownGenerator({
        outputDir: workDir,
        locale,
        sections: [{ id: 'overview', label: 'Overview', type: 'auto' }],
      });

      const pages = await generator.generate(analysis);
      expect(pages.length).toBeGreaterThan(0);

      // Every page should have frontmatter
      for (const page of pages) {
        expect(page.content.startsWith('---\n')).toBe(true);
      }
    }
  });
});

describe('Integration: Config Init Generation', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = setupTestDir();
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  it('detectStack + suggestedParsers produces valid parser config', async () => {
    writeFileSync(join(workDir, 'package.json'), JSON.stringify({
      dependencies: {
        '@nestjs/core': '^10.0.0',
        'typeorm': '^0.3.0',
      },
    }));
    mkdirSync(join(workDir, 'src'));
    writeFileSync(join(workDir, 'src', 'app.ts'), '');

    const stack = await detectStack(workDir);

    // Verify suggested parser has all needed fields for config generation
    const nestjsSuggestion = stack.suggestedParsers.find(p => p.package === '@codedocs/parser-typescript-nestjs');
    expect(nestjsSuggestion).toBeDefined();
    expect(nestjsSuggestion!.importName).toBe('nestjsParser');
    expect(nestjsSuggestion!.factoryFn).toBe('nestjsParser');
    expect(nestjsSuggestion!.options).toBeDefined();
    expect(nestjsSuggestion!.options!.detectOrm).toBe(true);
  });

  it('analysis-result.json round-trip preserves data integrity', async () => {
    const analysis = createAnalysisResult();
    const outputPath = join(workDir, 'analysis-result.json');

    // Write
    const analysisData = {
      timestamp: new Date().toISOString(),
      config: { name: 'Test', language: 'TypeScript', locale: 'en' },
      summary: {
        totalFiles: analysis.summary.totalFiles,
        successCount: analysis.summary.totalFiles,
        errorCount: 0,
        totalExports: analysis.summary.endpoints,
        totalFunctions: analysis.summary.services,
        totalClasses: analysis.summary.entities,
      },
      results: [analysis],
    };
    writeFileSync(outputPath, JSON.stringify(analysisData, null, 2));

    // Read back
    const loaded = JSON.parse(readFileSync(outputPath, 'utf-8'));

    expect(loaded.results.length).toBe(1);
    const loadedResult = loaded.results[0];

    // Verify all data survived serialization
    expect(loadedResult.endpoints.length).toBe(analysis.endpoints.length);
    expect(loadedResult.entities.length).toBe(analysis.entities.length);
    expect(loadedResult.services.length).toBe(analysis.services.length);
    expect(loadedResult.types.length).toBe(analysis.types.length);
    expect(loadedResult.dependencies.length).toBe(analysis.dependencies.length);

    // Verify nested data
    expect(loadedResult.endpoints[0].parameters).toBeDefined();
    expect(loadedResult.entities[0].columns).toBeDefined();
    expect(loadedResult.entities[0].relations).toBeDefined();
  });
});
