# NestJS Example

A sample TypeScript NestJS REST API demonstrating CodeDocs parser capabilities.

## Stack

- TypeScript
- NestJS 10
- TypeORM
- class-validator

## What CodeDocs Detects

- REST endpoints from `@Controller` / `@Get` / `@Post` / `@Put` / `@Delete`
- TypeORM entities from `@Entity` / `@Column` / `@PrimaryGeneratedColumn`
- Entity relationships (`@OneToMany`, `@ManyToOne`)
- DTOs with validation decorators
- Injectable services with dependencies

## Usage

```bash
cd examples/nestjs
npx codedocs init --detect
npx codedocs build
```
