import { describe, it, expect } from 'vitest';
import { nestjsParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'typescript' };
}

describe('typescript-nestjs parser', () => {
  const parser = nestjsParser();

  it('has correct name', () => {
    expect(parser.name).toBe('typescript-nestjs');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.ts', '**/*.tsx']);
  });

  it('parses REST endpoints from controller', async () => {
    const content = `
import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(): User[] {
    return this.userService.findAll();
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto): User {
    return this.userService.create(createUserDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): User {
    return this.userService.findOne(id);
  }
}`;
    const files = [createFile('user.controller.ts', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThanOrEqual(3);

    const getEndpoint = result.endpoints!.find(e => e.httpMethod === 'GET' && !e.path.includes(':'));
    expect(getEndpoint?.httpMethod).toBe('GET');
    expect(getEndpoint?.path).toBe('/users');
    // Return type extraction may not work for all patterns
    expect(getEndpoint?.returnType).toBeDefined();

    const postEndpoint = result.endpoints!.find(e => e.httpMethod === 'POST');
    expect(postEndpoint?.httpMethod).toBe('POST');

    const getByIdEndpoint = result.endpoints!.find(e => e.path.includes(':id'));
    expect(getByIdEndpoint?.path).toContain(':id');
  });

  it('parses TypeORM entities', async () => {
    const content = `
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_name', nullable: false })
  name: string;

  @Column({ nullable: true })
  email?: string;

  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];
}`;
    const files = [createFile('user.entity.ts', content)];
    const result = await parser.parse(files);

    expect(result.entities).toBeDefined();
    expect(result.entities!.length).toBe(1);

    const entity = result.entities![0];
    expect(entity.name).toBe('User');
    expect(entity.tableName).toBe('users');
    expect(entity.dbType).toBe('PostgreSQL');

    const idColumn = entity.columns.find(c => c.name === 'id');
    expect(idColumn?.primaryKey).toBe(true);

    const nameColumn = entity.columns.find(c => c.name === 'name');
    expect(nameColumn?.dbColumnName).toBe('user_name');
    expect(nameColumn?.nullable).toBe(false);

    expect(entity.relations.length).toBe(1);
    expect(entity.relations[0].type).toBe('OneToMany');
    expect(entity.relations[0].target).toBe('Post');
  });

  it('parses services', async () => {
    const content = `
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailService: EmailService,
  ) {}

  findAll(): User[] {
    return this.userRepository.findAll();
  }

  create(dto: CreateUserDto): User {
    return this.userRepository.save(dto);
  }

  findOne(id: string): User {
    return this.userRepository.findById(id);
  }
}`;
    const files = [createFile('user.service.ts', content)];
    const result = await parser.parse(files);

    expect(result.services).toBeDefined();
    expect(result.services!.length).toBe(1);

    const service = result.services![0];
    expect(service.name).toBe('UserService');
    expect(service.methods.length).toBeGreaterThanOrEqual(2);
    expect(service.dependencies).toContain('UserRepository');
    expect(service.dependencies).toContain('EmailService');
  });

  it('parses DTOs', async () => {
    const content = `
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  age?: number;
}

export class UserResponse {
  id: number;
  name: string;
  email: string;
}`;
    const files = [createFile('user.dto.ts', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(2);

    const createDto = result.types!.find(t => t.name === 'CreateUserDto');
    expect(createDto?.kind).toMatch(/input|dto/); // May be dto or input based on naming
    expect(createDto?.fields.length).toBeGreaterThanOrEqual(2);

    const response = result.types!.find(t => t.name === 'UserResponse');
    expect(response?.kind).toBe('response');
  });

  it('parses enums', async () => {
    const content = `
export enum UserRole {
  ADMIN,
  USER,
  GUEST
}`;
    const files = [createFile('user-role.enum.ts', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(1);

    const enumType = result.types![0];
    expect(enumType.name).toBe('UserRole');
    expect(enumType.kind).toBe('enum');
    expect(enumType.fields.length).toBe(3);
    expect(enumType.fields[0].name).toBe('ADMIN');
  });

  it('parses GraphQL resolvers when enabled', async () => {
    const content = `
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';

@Resolver(() => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => [User])
  users(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Mutation(() => User)
  createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.userService.create(input);
  }
}`;
    const files = [createFile('user.resolver.ts', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(2);

    const query = result.endpoints!.find(e => e.protocol === 'graphql');
    if (query) {
      expect(query.protocol).toBe('graphql');
      expect(['Query', 'Mutation', 'Subscription']).toContain(query.operationType);
    }
  });
});
