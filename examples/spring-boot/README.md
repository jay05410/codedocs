# Spring Boot Example

A sample Java Spring Boot REST API demonstrating CodeDocs parser capabilities.

## Stack

- Java 21
- Spring Boot 3.2
- Spring Data JPA
- H2 Database

## What CodeDocs Detects

- REST endpoints from `@RestController` / `@GetMapping` / `@PostMapping` etc.
- JPA entities from `@Entity` / `@Table` / `@Column`
- Entity relationships (`@ManyToOne`, `@OneToMany`)
- Request/response DTOs

## Usage

```bash
cd examples/spring-boot
npx codedocs init --detect
npx codedocs build
```
