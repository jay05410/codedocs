#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { analyzeCommand } from './commands/analyze.js';
import { generateCommand } from './commands/generate.js';
import { buildCommand } from './commands/build.js';
import { serveCommand } from './commands/serve.js';

const program = new Command();
program
  .name('codedocs')
  .description('AI-powered code documentation generator')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(analyzeCommand);
program.addCommand(generateCommand);
program.addCommand(buildCommand);
program.addCommand(serveCommand);

export function run() {
  program.parse();
}

run();
