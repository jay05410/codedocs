import { spawn } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';

export interface RunSubprocessOptions {
  verbose?: boolean;
  quiet?: boolean;
}

export async function runSubprocess(
  name: string,
  args: string[],
  options: RunSubprocessOptions = {}
): Promise<void> {
  const spinner = options.quiet ? null : ora(`Running ${name}...`).start();

  return new Promise((resolve, reject) => {
    const cmd = spawn('npx', ['codedocs', ...args], {
      stdio: options.verbose ? 'inherit' : 'pipe',
      shell: true,
    });

    let output = '';
    if (!options.verbose) {
      cmd.stdout?.on('data', (data) => { output += data.toString(); });
      cmd.stderr?.on('data', (data) => { output += data.toString(); });
    }

    cmd.on('close', (code) => {
      if (code === 0) {
        spinner?.succeed(`${name} complete`);
        resolve();
      } else {
        spinner?.fail(`${name} failed`);
        if (output) {
          console.error(chalk.red(output));
        }
        reject(new Error(`${name} exited with code ${code}`));
      }
    });

    cmd.on('error', (error) => {
      spinner?.fail(`${name} failed`);
      reject(error);
    });
  });
}
