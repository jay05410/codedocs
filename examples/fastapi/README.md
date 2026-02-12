# FastAPI Example

A sample Python FastAPI REST API demonstrating CodeDocs parser capabilities.

## Stack

- Python 3.12
- FastAPI
- SQLAlchemy 2.0
- Pydantic v2

## What CodeDocs Detects

- REST endpoints from `@app.get` / `@app.post` / `@app.put` / `@app.delete`
- SQLAlchemy models from `class ... (Base)` with `Column` definitions
- Entity relationships (`relationship`, `ForeignKey`)
- Pydantic schemas (request/response DTOs)
- Query parameters and path parameters

## Usage

```bash
cd examples/fastapi
npx codedocs init --detect
npx codedocs build
```
