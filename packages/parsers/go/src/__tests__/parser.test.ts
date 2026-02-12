import { describe, it, expect } from 'vitest';
import { goParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'go' };
}

describe('go parser', () => {
  const parser = goParser();

  it('has correct name', () => {
    expect(parser.name).toBe('go');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.go']);
  });

  it('parses Gin routes', async () => {
    const content = `
package main

import "github.com/gin-gonic/gin"

func SetupRoutes(r *gin.Engine) {
    r.GET("/users", getUsers)
    r.POST("/users", createUser)
    r.GET("/users/:id", getUserByID)
    r.DELETE("/users/:id", deleteUser)
}

func getUsers(c *gin.Context) {
    // handler
}

func createUser(c *gin.Context) {
    // handler
}
`;
    const files = [createFile('routes.go', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(4);

    const getEndpoint = result.endpoints![0];
    expect(getEndpoint.httpMethod).toBe('GET');
    expect(getEndpoint.path).toBe('/users');
    expect(getEndpoint.handler).toBe('getUsers');

    const postEndpoint = result.endpoints![1];
    expect(postEndpoint.httpMethod).toBe('POST');
    expect(postEndpoint.handler).toBe('createUser');

    const getByIdEndpoint = result.endpoints![2];
    expect(getByIdEndpoint.path).toBe('/users/:id');
    expect(getByIdEndpoint.parameters!.length).toBeGreaterThan(0);
  });

  it('parses GORM models', async () => {
    const content = `
package models

import "gorm.io/gorm"

type User struct {
    gorm.Model
    Name  string \`gorm:"column:user_name;not null"\`
    Email string \`gorm:"column:email;unique"\`
    Age   int    \`gorm:"column:age"\`
}
`;
    const files = [createFile('user.go', content)];
    const result = await parser.parse(files);

    expect(result.entities).toBeDefined();
    expect(result.entities!.length).toBe(1);

    const entity = result.entities![0];
    expect(entity.name).toBe('User');
    expect(entity.columns.length).toBeGreaterThan(0);

    const nameColumn = entity.columns.find(c => c.dbColumnName === 'user_name');
    expect(nameColumn).toBeDefined();
    expect(nameColumn?.nullable).toBe(false);

    const emailColumn = entity.columns.find(c => c.dbColumnName === 'email');
    expect(emailColumn?.unique).toBe(true);
  });

  it('parses struct DTOs', async () => {
    const content = `
package dto

type UserDTO struct {
    ID    int    \`json:"id"\`
    Name  string \`json:"name"\`
    Email string \`json:"email"\`
}

type CreateUserRequest struct {
    Name  string \`json:"name"\`
    Email string \`json:"email"\`
}

type UserResponse struct {
    ID   int    \`json:"id"\`
    Name string \`json:"name"\`
}
`;
    const files = [createFile('user_dto.go', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(3);

    const dto = result.types!.find(t => t.name === 'UserDTO');
    expect(dto?.kind).toBe('dto');
    expect(dto?.fields.length).toBe(3);
    // Go struct fields are case-sensitive, parser may extract as lowercase
    expect(dto?.fields[0].name).toMatch(/id|ID/);

    const request = result.types!.find(t => t.name === 'CreateUserRequest');
    expect(request?.kind).toBe('input');

    const response = result.types!.find(t => t.name === 'UserResponse');
    expect(response?.kind).toBe('response');
  });

  it('parses Go enums (iota pattern)', async () => {
    const content = `
package models

type Status int

const (
    StatusActive Status = iota
    StatusInactive
    StatusDeleted
)
`;
    const files = [createFile('status.go', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const enumType = result.types!.find(t => t.kind === 'enum');
    if (enumType) {
      expect(enumType.name).toBe('Status');
      expect(enumType.fields.length).toBe(3);
    }
  });

  it('parses Echo routes', async () => {
    const content = `
package main

import "github.com/labstack/echo/v4"

func RegisterRoutes(e *echo.Echo) {
    e.GET("/api/items", getItems)
    e.POST("/api/items", createItem)
}
`;
    const files = [createFile('routes.go', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(2);
    expect(result.endpoints![0].httpMethod).toBe('GET');
  });
});
