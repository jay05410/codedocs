import { describe, it, expect } from 'vitest';
import { reactParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'typescript' };
}

describe('react parser', () => {
  const parser = reactParser();

  it('has correct name', () => {
    expect(parser.name).toBe('react');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.tsx', '**/*.jsx', '**/*.ts', '**/*.js']);
  });

  it('parses Next.js Pages Router API routes', async () => {
    const content = `
export default function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ users: [] });
  } else if (req.method === 'POST') {
    res.status(201).json({ created: true });
  }
}
`;
    const files = [createFile('src/pages/api/users.ts', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBe(2);
    expect(result.endpoints![0].httpMethod).toBe('GET');
    expect(result.endpoints![0].path).toBe('/api/users');
    expect(result.endpoints![1].httpMethod).toBe('POST');
  });

  it('parses Next.js App Router route handlers', async () => {
    const content = `
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ items: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ created: true });
}
`;
    const files = [createFile('src/app/api/items/route.ts', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThanOrEqual(1);

    // App Router endpoint has correct path (may also match Pages Router detection)
    const appRouterEndpoint = result.endpoints!.find(e => e.tags?.includes('next-app-router'));
    expect(appRouterEndpoint).toBeDefined();
    expect(appRouterEndpoint?.path).toBe('/api/items');
  });

  it('parses React components', async () => {
    const content = `
interface UserCardProps {
  name: string;
  email: string;
  age?: number;
}

export function UserCard({ name, email, age }: UserCardProps) {
  return (
    <div>
      <h1>{name}</h1>
      <p>{email}</p>
    </div>
  );
}
`;
    const files = [createFile('components/UserCard.tsx', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const component = result.types!.find(t => t.name === 'UserCard');
    expect(component).toBeDefined();
  });

  it('parses custom hooks', async () => {
    const content = `
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // fetch user
  }, []);

  return { user, setUser };
}

export function useFetch(url: string) {
  const [data, setData] = useState(null);
  return { data, loading: false };
}
`;
    const files = [createFile('hooks/useAuth.ts', content)];
    const result = await parser.parse(files);

    expect(result.services).toBeDefined();
    expect(result.services!.length).toBe(2);

    const authHook = result.services!.find(s => s.name === 'useAuth');
    expect(authHook).toBeDefined();
    expect(authHook?.name).toBe('useAuth');

    const fetchHook = result.services!.find(s => s.name === 'useFetch');
    expect(fetchHook).toBeDefined();
  });

  it('parses Props interfaces', async () => {
    const content = `
export interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export interface CardProps {
  title: string;
  children: React.ReactNode;
}
`;
    const files = [createFile('types/props.ts', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    expect(result.types!.length).toBe(2);

    const buttonProps = result.types!.find(t => t.name === 'ButtonProps');
    expect(buttonProps?.kind).toBe('interface');
    expect(buttonProps?.fields.length).toBe(4);

    const cardProps = result.types!.find(t => t.name === 'CardProps');
    expect(cardProps?.fields.length).toBe(2);
  });

  it('parses Context providers', async () => {
    const content = `
import { createContext, useContext } from 'react';

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
`;
    const files = [createFile('context/AuthContext.tsx', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const context = result.types!.find(t => t.name === 'AuthContext');
    expect(context).toBeDefined();

    expect(result.services).toBeDefined();
    const provider = result.services!.find(s => s.name === 'AuthProvider');
    expect(provider).toBeDefined();
  });
});
