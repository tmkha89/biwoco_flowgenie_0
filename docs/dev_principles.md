FlowGenie — Development Principles & Engineering Standards
1. Philosophy

FlowGenie follows clarity over cleverness.
Every module must be predictable, testable, and documented.
We build automation software — the system should be as automatable as the workflows it runs.

2. Code Style

Language: TypeScript

Framework: NestJS (backend), React (frontend)

Formatting: Prettier + ESLint

Commit Messages: Conventional Commits (feat:, fix:, test:, docs:, chore:)

Naming:

Classes: PascalCase

Variables: camelCase

Constants: UPPER_SNAKE_CASE

Private members: prefixed with _

Example:

class WorkflowService {
  private readonly _queue: Queue;
  constructor(private readonly prisma: PrismaService) {}
}

3. Test-Driven Development (TDD)

Always write tests before writing implementation code.

TDD Cycle

Red → Write a failing test describing the behavior.

Green → Implement the minimal code to make it pass.

Refactor → Clean up without changing logic.

All PRs must include new or updated test cases.

Required Test Types

Unit Tests: For all services and utilities (Jest)

Integration Tests: For controllers and database interactions

E2E Tests: Optional, for major user flows (login, workflow execution)

4. Testing Rules

Each function must have at least:

One valid test case

One invalid (error) test case

One boundary test case

Use describe() and it() blocks clearly:

describe('WorkflowService', () => {
  it('should create a workflow successfully', async () => { /* ... */ })
  it('should throw error when missing name', async () => { /* ... */ })
})

5. Swagger Documentation

All routes must include @openapi JSDoc blocks:

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and return JWT tokens.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */

6. Branching & CI/CD

Branches follow convention:

feature/<feature-name>

fix/<bug-name>

test/<module>

Main Branches:

main: Production

uat: User Acceptance Testing

staging: Pre-production

Each pull request triggers:

Lint check

Unit tests

Vulnerability scan

Build validation

7. Worker Rules

Workers must never call external APIs directly inside the main service.

Jobs should be small, stateless, and idempotent (safe to re-run).

Each workflow execution must log:

workflow_id

status

error_message (if any)

execution_time

8. Environment Variables

All environment variables are declared in .env.example.
Backend uses .env.local during development.

Example:

DATABASE_URL=postgresql://user:pass@localhost:5432/flowgenie
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecretkey
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

9. Pull Request Checklist

 Tests written or updated

 Swagger docs added

 No ESLint warnings

 Environment variables documented

 Code reviewed and approved

10. Example Cursor Prompt

Based on docs/dev_principles.md, generate Jest unit tests for AuthService (login, refreshToken, logout) following TDD. The tests should include success, invalid, and expired-token scenarios.