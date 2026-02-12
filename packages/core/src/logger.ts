// packages/core/src/logger.ts
// Simple logger utility for CodeDocs

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export class Logger {
  constructor(
    private level: LogLevel = LogLevel.INFO,
    private prefix?: string
  ) {}

  debug(msg: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      const prefixed = this.prefix ? `[${this.prefix}] ${msg}` : msg;
      console.debug(prefixed, ...args);
    }
  }

  info(msg: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const prefixed = this.prefix ? `[${this.prefix}] ${msg}` : msg;
      console.log(prefixed, ...args);
    }
  }

  warn(msg: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const prefixed = this.prefix ? `[${this.prefix}] ${msg}` : msg;
      console.warn(prefixed, ...args);
    }
  }

  error(msg: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const prefixed = this.prefix ? `[${this.prefix}] ${msg}` : msg;
      console.error(prefixed, ...args);
    }
  }

  child(prefix: string): Logger {
    const childPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger(this.level, childPrefix);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();
