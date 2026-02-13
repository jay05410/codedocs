import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, basename, dirname } from 'path';
import { loadConfig, getStrings } from '@codedocs/core';
import type { Locale } from '@codedocs/core';
import { getCliStrings, t, initLocale } from '../i18n.js';
import { Marked } from 'marked';

export const buildCommand = new Command('build')
  .description('Build production-ready documentation site')
  .option('-c, --config <path>', 'Path to config file', 'codedocs.config.ts')
  .option('--skip-analyze', 'Skip analysis step')
  .option('--skip-generate', 'Skip generation step')
  .option('--verbose', 'Show detailed build output')
  .action(async (options) => {
    const s = getCliStrings().cli;
    console.log(chalk.bold.cyan(`\n🏗️  ${s.buildTitle}\n`));

    try {
      // Load config
      const configPath = resolve(process.cwd(), options.config);
      if (!existsSync(configPath)) {
        console.error(chalk.red(`${s.configNotFound}: ${options.config}\n`));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      initLocale(config.docs?.locale);
      const strings = getCliStrings().cli;
      const outDir = './dist';

      // Step 1: Analyze
      if (!options.skipAnalyze) {
        await runCommand('analyze', ['analyze', '-c', options.config], options.verbose);
      } else {
        console.log(chalk.dim(`⊘ ${strings.skippingAnalysis}\n`));
      }

      // Step 2: Generate
      if (!options.skipGenerate) {
        await runCommand('generate', ['generate', '-c', options.config], options.verbose);
      } else {
        console.log(chalk.dim(`⊘ ${strings.skippingGeneration}\n`));
      }

      // Step 3: Build static HTML site
      console.log(chalk.cyan(strings.buildingSite));
      const spinner = ora(strings.buildingSite).start();
      await buildStaticSite('./docs-output', outDir, config);
      spinner.succeed(strings.buildComplete);

      // Summary
      console.log(chalk.green(`\n✓ ${strings.buildComplete}\n`));
      console.log(chalk.dim(`  ${t(strings.outputDirectory, { dir: outDir })}`));
      console.log(chalk.cyan(`\n${strings.nextSteps}`));
      console.log(chalk.dim(`  - ${t(strings.deployHint, { dir: outDir })}`));
      console.log(chalk.dim(`  - ${strings.previewLocalHint}\n`));
    } catch (error) {
      console.error(chalk.red(`\n✗ ${getCliStrings().cli.buildFailed}\n`));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

async function runCommand(
  name: string,
  args: string[],
  verbose: boolean
): Promise<void> {
  const spinner = ora(`Running ${name}...`).start();

  return new Promise((resolve, reject) => {
    const cmd = spawn('npx', ['codedocs', ...args], {
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true,
    });

    if (!verbose) {
      let output = '';
      cmd.stdout?.on('data', (data) => {
        output += data.toString();
      });
      cmd.stderr?.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(`${name} complete`);
          resolve();
        } else {
          spinner.fail(`${name} failed`);
          if (output) {
            console.error(chalk.red(output));
          }
          reject(new Error(`${name} exited with code ${code}`));
        }
      });
    } else {
      cmd.on('close', (code) => {
        if (code === 0) {
          spinner.succeed(`${name} complete`);
          resolve();
        } else {
          spinner.fail(`${name} failed`);
          reject(new Error(`${name} exited with code ${code}`));
        }
      });
    }

    cmd.on('error', (error) => {
      spinner.fail(`${name} failed`);
      reject(error);
    });
  });
}

async function buildStaticSite(docsDir: string, outDir: string, config: any): Promise<void> {
  const docsPath = resolve(process.cwd(), docsDir);
  const distPath = resolve(process.cwd(), outDir);

  if (!existsSync(docsPath)) {
    throw new Error(`Documentation directory not found: ${docsDir}. Run "codedocs generate" first.`);
  }

  // Create dist directory
  if (!existsSync(distPath)) {
    mkdirSync(distPath, { recursive: true });
  }

  // Collect all markdown files
  const mdFiles = collectMarkdownFiles(docsPath);

  if (mdFiles.length === 0) {
    throw new Error(`No markdown files found in ${docsDir}`);
  }

  // Get locale strings
  const locale = (config.docs?.locale || 'en') as Locale;
  const s = getStrings(locale);

  // Parse markdown files and build navigation
  const pages = mdFiles.map(filePath => {
    const raw = readFileSync(filePath, 'utf-8');
    const { meta, body } = extractFrontmatter(raw);
    const relPath = relative(docsPath, filePath);
    const slug = relPath.replace(/\.md$/, '');
    const title = meta.title || slug.split('/').pop() || 'Untitled';
    const position = meta.sidebar_position ? Number(meta.sidebar_position) : 999;
    return { filePath, relPath, slug, title, body, meta, position };
  });

  // Sort pages by sidebar position
  pages.sort((a, b) => a.position - b.position);

  // Build sidebar HTML
  const sidebarHtml = pages
    .map(p => `<a href="./${p.slug}.html" class="nav-link">${escapeHtml(p.title)}</a>`)
    .join('\n        ');

  // Initialize marked with custom renderer for mermaid
  const marked = new Marked({
    renderer: {
      code(token) {
        if (token.lang === 'mermaid') {
          return `<div class="mermaid">${token.text}</div>`;
        }
        return `<pre><code class="language-${token.lang || ''}">${escapeHtml(token.text)}</code></pre>`;
      }
    }
  });

  // Get project name from config
  const projectName = config.name || config.docs?.title || 'Documentation';

  // Generate HTML for each page
  for (const page of pages) {
    const htmlContent = await marked.parse(page.body);
    const htmlPage = generateHtmlPage({
      title: page.title,
      projectName,
      content: htmlContent,
      sidebarHtml,
      currentSlug: page.slug,
      locale,
      s,
    });

    const outFile = join(distPath, `${page.slug}.html`);
    const outFileDir = dirname(outFile);
    if (!existsSync(outFileDir)) {
      mkdirSync(outFileDir, { recursive: true });
    }
    writeFileSync(outFile, htmlPage, 'utf-8');
  }

  // Generate index.html that redirects to the index page or first page
  const indexPage = pages.find(p => p.slug === 'index') || pages[0];
  if (indexPage && indexPage.slug !== 'index') {
    // Create redirect index.html
    writeFileSync(
      join(distPath, 'index.html'),
      `<!DOCTYPE html><meta http-equiv="refresh" content="0;url=./${indexPage.slug}.html">`,
      'utf-8'
    );
  }

  // Write CSS file
  const assetsDir = join(distPath, 'assets');
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }
  writeFileSync(join(assetsDir, 'style.css'), getStylesheet(), 'utf-8');
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = value;
    }
  }
  return { meta, body: match[2] };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtmlPage(opts: {
  title: string;
  projectName: string;
  content: string;
  sidebarHtml: string;
  currentSlug: string;
  locale: string;
  s: any;
}): string {
  return `<!DOCTYPE html>
<html lang="${opts.locale}" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)} - ${escapeHtml(opts.projectName)}</title>
  <link rel="stylesheet" href="./assets/style.css">
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <a href="./index.html" class="logo">${escapeHtml(opts.projectName)}</a>
      <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
        <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </header>
  <div class="layout">
    <nav class="sidebar">
      ${opts.sidebarHtml}
    </nav>
    <main class="content">
      <article>
        ${opts.content}
      </article>
      <footer class="footer">
        <p>Generated by <a href="https://github.com/jay05410/codedocs">CodeDocs</a></p>
      </footer>
    </main>
  </div>
  <script>
    function toggleTheme() {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('codedocs-theme', next);
    }
    // Restore theme
    const saved = localStorage.getItem('codedocs-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    // Active nav link
    const current = location.pathname.split('/').pop()?.replace('.html', '');
    document.querySelectorAll('.nav-link').forEach(a => {
      if (a.getAttribute('href')?.includes(current + '.html')) a.classList.add('active');
    });
  </script>
</body>
</html>`;
}

function getStylesheet(): string {
  return `
:root, [data-theme="light"] {
  --bg: #ffffff;
  --bg-secondary: #f8f9fa;
  --text: #1a1a2e;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --primary: #2563eb;
  --primary-light: #dbeafe;
  --code-bg: #f1f5f9;
  --sidebar-bg: #f8fafc;
  --header-bg: #ffffff;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}
[data-theme="dark"] {
  --bg: #0f172a;
  --bg-secondary: #1e293b;
  --text: #e2e8f0;
  --text-secondary: #94a3b8;
  --border: #334155;
  --primary: #60a5fa;
  --primary-light: #1e3a5f;
  --code-bg: #1e293b;
  --sidebar-bg: #0f172a;
  --header-bg: #0f172a;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.7;
}
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
}
.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primary);
  text-decoration: none;
}
.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  color: var(--text);
  display: flex;
  align-items: center;
}
[data-theme="light"] .moon-icon { display: none; }
[data-theme="dark"] .sun-icon { display: none; }
.layout {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 60px);
}
.sidebar {
  width: 260px;
  min-width: 260px;
  padding: 1.5rem 1rem;
  border-right: 1px solid var(--border);
  background: var(--sidebar-bg);
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}
.nav-link {
  display: block;
  padding: 0.5rem 0.75rem;
  margin: 0.15rem 0;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.nav-link:hover { background: var(--bg-secondary); color: var(--text); }
.nav-link.active { background: var(--primary-light); color: var(--primary); font-weight: 600; }
.content {
  flex: 1;
  padding: 2rem 3rem;
  max-width: 900px;
  min-width: 0;
}
article h1 { font-size: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
article h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); }
article h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; }
article p { margin: 0.75rem 0; }
article ul, article ol { margin: 0.75rem 0; padding-left: 1.5rem; }
article li { margin: 0.25rem 0; }
article a { color: var(--primary); text-decoration: none; }
article a:hover { text-decoration: underline; }
article table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: 0.9rem;
}
article th {
  background: var(--bg-secondary);
  font-weight: 600;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
}
article td {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
}
article tr:hover { background: var(--bg-secondary); }
article code {
  background: var(--code-bg);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.875em;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}
article pre {
  background: var(--code-bg);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
  border: 1px solid var(--border);
}
article pre code {
  background: none;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.6;
}
article blockquote {
  border-left: 3px solid var(--primary);
  padding: 0.5rem 1rem;
  margin: 1rem 0;
  background: var(--bg-secondary);
  border-radius: 0 6px 6px 0;
}
article details {
  margin: 0.75rem 0;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}
article summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--text-secondary);
}
article hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
article strong { font-weight: 600; }
.mermaid { margin: 1rem 0; text-align: center; }
.footer {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 0.85rem;
}
.footer a { color: var(--primary); text-decoration: none; }
@media (max-width: 768px) {
  .sidebar { display: none; }
  .content { padding: 1rem; }
}
`;
}
