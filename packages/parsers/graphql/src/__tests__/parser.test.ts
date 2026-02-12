import { describe, it, expect } from 'vitest';
import { graphqlParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'graphql' };
}

describe('graphql parser', () => {
  const parser = graphqlParser();

  it('has correct name', () => {
    expect(parser.name).toBe('graphql');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.graphql', '**/*.gql', '**/*.graphqls']);
  });

  it('parses Query and Mutation operations', async () => {
    const content = `
type Query {
  users: [User!]!
  user(id: ID!): User
  posts(limit: Int = 10): [Post!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
  updateUser(id: ID!, name: String): User
  deleteUser(id: ID!): Boolean!
}

type Subscription {
  userCreated: User!
}
`;
    const files = [createFile('schema.graphql', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThanOrEqual(6);

    const usersQuery = result.endpoints!.find(e => e.fieldName === 'users');
    expect(usersQuery?.operationType).toBe('Query');
    expect(usersQuery?.protocol).toBe('graphql');
    expect(usersQuery?.returnType).toBeDefined();

    const userQuery = result.endpoints!.find(e => e.fieldName === 'user');
    if (userQuery) {
      expect(userQuery.parameters!.length).toBeGreaterThanOrEqual(1);
    }

    const createMutation = result.endpoints!.find(e => e.fieldName === 'createUser');
    expect(createMutation?.operationType).toBe('Mutation');
    expect(createMutation?.parameters!.length).toBe(2);
    expect(createMutation?.parameters![0].name).toBe('name');

    const subscription = result.endpoints!.find(e => e.fieldName === 'userCreated');
    expect(subscription?.operationType).toBe('Subscription');
  });

  it('parses type definitions', async () => {
    const content = `
type User {
  id: ID!
  name: String!
  email: String
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  content: String
  author: User!
}
`;
    const files = [createFile('types.graphql', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(2);

    const userType = result.types!.find(t => t.name === 'User');
    expect(userType?.kind).toBe('type');
    expect(userType?.fields.length).toBe(4);
    expect(userType?.fields[0].name).toBe('id');
    expect(userType?.fields[0].required).toBe(true);
    expect(userType?.fields[2].required).toBe(false);

    const postType = result.types!.find(t => t.name === 'Post');
    expect(postType?.fields.length).toBe(4);
  });

  it('parses input types', async () => {
    const content = `
input CreateUserInput {
  name: String!
  email: String!
  age: Int
}

input UpdateUserInput {
  name: String
  email: String
}
`;
    const files = [createFile('inputs.graphql', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const inputs = result.types!.filter(t => t.kind === 'input');
    expect(inputs.length).toBe(2);

    const createInput = inputs.find(t => t.name === 'CreateUserInput');
    expect(createInput?.fields.length).toBe(3);
    expect(createInput?.fields[0].required).toBe(true);
    expect(createInput?.fields[2].required).toBe(false);
  });

  it('parses enum types', async () => {
    const content = `
enum UserRole {
  ADMIN
  USER
  GUEST
}

enum Status {
  ACTIVE
  INACTIVE
  DELETED
}
`;
    const files = [createFile('enums.graphql', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const enums = result.types!.filter(t => t.kind === 'enum');
    expect(enums.length).toBe(2);

    const roleEnum = enums.find(t => t.name === 'UserRole');
    expect(roleEnum?.fields.length).toBe(3);
    expect(roleEnum?.fields[0].name).toBe('ADMIN');
    expect(roleEnum?.fields[1].name).toBe('USER');

    const statusEnum = enums.find(t => t.name === 'Status');
    expect(statusEnum?.fields.length).toBe(3);
  });

  it('parses interface types', async () => {
    const content = `
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: String!
  updatedAt: String!
}

type User implements Node & Timestamped {
  id: ID!
  name: String!
  createdAt: String!
  updatedAt: String!
}
`;
    const files = [createFile('interfaces.graphql', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const interfaces = result.types!.filter(t => t.kind === 'interface');
    expect(interfaces.length).toBe(2);

    const nodeInterface = interfaces.find(t => t.name === 'Node');
    expect(nodeInterface?.fields.length).toBe(1);
    expect(nodeInterface?.fields[0].name).toBe('id');

    const userType = result.types!.find(t => t.name === 'User' && t.kind === 'type');
    expect(userType).toBeDefined();
  });

  it('parses extended types', async () => {
    const content = `
type Query {
  users: [User!]!
}

extend type Query {
  posts: [Post!]!
}
`;
    const files = [createFile('schema.graphql', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(2);
    expect(result.endpoints!.some(e => e.fieldName === 'users')).toBe(true);
    expect(result.endpoints!.some(e => e.fieldName === 'posts')).toBe(true);
  });
});
