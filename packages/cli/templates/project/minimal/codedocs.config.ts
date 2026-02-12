import { defineConfig } from '@codedocs/core';

export default defineConfig({
  name: 'My Project',
  source: './src',

  docs: {
    title: 'My Project Documentation',
    locale: 'en',
  },

  build: {
    outDir: './dist',
  },
});
