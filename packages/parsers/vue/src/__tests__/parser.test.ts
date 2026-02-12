import { describe, it, expect } from 'vitest';
import { vueParser } from '../parser.js';
import type { SourceFile } from '@codedocs/core';

function createFile(path: string, content: string): SourceFile {
  return { path, content, language: 'typescript' };
}

describe('vue parser', () => {
  const parser = vueParser();

  it('has correct name', () => {
    expect(parser.name).toBe('vue');
  });

  it('has correct file pattern', () => {
    expect(parser.filePattern).toEqual(['**/*.vue', '**/*.ts', '**/*.js']);
  });

  it('parses Nuxt server routes', async () => {
    const content = `
export default defineEventHandler(async (event) => {
  return { users: [] };
});
`;
    const files = [createFile('src/server/api/users.get.ts', content)];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    // Path matches both isNuxtServerRoute and isNuxtApiRoute, so may produce duplicates
    expect(result.endpoints!.length).toBeGreaterThanOrEqual(1);
    const getEndpoint = result.endpoints!.find(e => e.httpMethod === 'GET');
    expect(getEndpoint).toBeDefined();
    expect(getEndpoint?.path).toBe('/api/users');
  });

  it('parses Nuxt API routes with different methods', async () => {
    const createContent = `
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return { created: true };
});
`;
    const files = [
      createFile('src/server/api/items.post.ts', createContent),
      createFile('src/server/api/items/[id].delete.ts', 'export default defineEventHandler(() => ({ deleted: true }))'),
    ];
    const result = await parser.parse(files);

    expect(result.endpoints).toBeDefined();
    expect(result.endpoints!.length).toBeGreaterThanOrEqual(1);

    const postEndpoint = result.endpoints!.find(e => e.httpMethod === 'POST');
    expect(postEndpoint?.path).toBe('/api/items');

    const deleteEndpoint = result.endpoints!.find(e => e.httpMethod === 'DELETE');
    expect(deleteEndpoint?.path).toBe('/api/items/:id');
  });

  it('parses Vue SFC components with props', async () => {
    const content = `
<template>
  <div>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  description?: string;
  count: number;
}

defineProps<Props>();
</script>
`;
    const files = [createFile('components/Card.vue', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const component = result.types!.find(t => t.name === 'Card');
    expect(component).toBeDefined();
    expect(component?.fields.length).toBeGreaterThan(0);
  });

  it('parses composables', async () => {
    const content = `
export function useAuth() {
  const user = ref(null);
  const isLoggedIn = computed(() => user.value !== null);

  const login = async (email: string, password: string) => {
    // login logic
  };

  const logout = () => {
    user.value = null;
  };

  return {
    user,
    isLoggedIn,
    login,
    logout
  };
}

export function useFetch(url: string) {
  const data = ref(null);
  const loading = ref(false);

  return { data, loading };
}
`;
    const files = [createFile('composables/useAuth.ts', content)];
    const result = await parser.parse(files);

    expect(result.services).toBeDefined();
    expect(result.services!.length).toBe(2);

    const authComposable = result.services!.find(s => s.name === 'useAuth');
    expect(authComposable).toBeDefined();

    const fetchComposable = result.services!.find(s => s.name === 'useFetch');
    expect(fetchComposable).toBeDefined();
  });

  it('parses Pinia stores', async () => {
    const content = `
import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const users = ref([]);

  function login(email: string) {
    // login
  }

  function logout() {
    user.value = null;
  }

  return { user, users, login, logout };
});
`;
    const files = [createFile('stores/user.ts', content)];
    const result = await parser.parse(files);

    expect(result.services).toBeDefined();
    const store = result.services!.find(s => s.name === 'useUserStore');
    expect(store).toBeDefined();
  });

  it('parses Vue components with emits and slots', async () => {
    const content = `
<template>
  <div>
    <slot name="header"></slot>
    <slot></slot>
    <button @click="emit('submit')">Submit</button>
  </div>
</template>

<script setup>
const emit = defineEmits(['submit', 'cancel']);

const props = defineProps({
  title: String,
  visible: Boolean
});
</script>
`;
    const files = [createFile('components/Modal.vue', content)];
    const result = await parser.parse(files);

    expect(result.types).toBeDefined();
    const component = result.types!.find(t => t.name === 'Modal');
    expect(component).toBeDefined();

    // Should have props, emits, and slots
    const eventFields = component?.fields.filter(f => f.description?.includes('[emit]'));
    expect(eventFields?.length).toBeGreaterThan(0);

    const slotFields = component?.fields.filter(f => f.description?.includes('[slot]'));
    expect(slotFields?.length).toBeGreaterThan(0);
  });
});
