// @codedocs/vite-plugin - Vite SSG plugin for CodeDocs
export { codedocsPlugin, type CodeDocsViteOptions } from './plugin.js';
export { createMarkdownProcessor } from './markdown-loader.js';
export { buildStaticPages, type SsgPage } from './ssg.js';
export { startDevServer, type DevServerOptions } from './dev-server.js';
