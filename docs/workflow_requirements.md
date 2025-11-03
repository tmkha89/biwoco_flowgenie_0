Project Context: FlowGenie — Workflow Automation Platform
1. Project Goal

FlowGenie is a workflow automation platform that allows users to connect various services (Google, Gmail, Calendar, etc.) to create and execute automated flows and actions.
Example: When a new email arrives in Gmail → automatically create an event in Google Calendar.

2. System Architecture

Frontend: React + Vite + Tailwind + Zustand (state management)

Backend: NestJS + Prisma + PostgreSQL

Queue System: BullMQ (Redis)

Worker: Handles workflow job execution

Authentication: JWT (access + refresh tokens)

Integration Layer: Connectors for Google APIs (Gmail, Calendar, Sheets, etc.)

3. Development Principles

TDD-first: Always write tests before implementation.

Clean Architecture: Clear separation — Controller → Service → Repository.

Error Handling: Always throw HttpException in NestJS with proper error codes.

Authentication: Login/Signup endpoints must return JWT (access, refresh, expires_in, user info).

Worker Isolation: Workflow logic runs inside the worker; backend only enqueues jobs.

4. Core Flows (Login + Workflow)
4.1. Login Flow

User sends POST /auth/login with email/password.

Backend validates credentials → returns access_token, refresh_token, expires_in, and user.

Frontend stores tokens in localStorage and redirects to /dashboard.

4.2. Workflow Execution

User creates a flow in the UI (trigger + actions).

Flow is stored in the DB; each trigger/action stores its configuration.

When an event occurs (e.g. from Google API webhook) → backend receives it → enqueues job to worker.

Worker executes each action in the flow and logs the execution results.

5. Cursor Development Workflow

When working with Cursor:

Read this file first to understand the full project context.

Write tests first (unit or e2e) for the module you plan to implement.

Implement code to make the tests pass.

Add Swagger docs for every API using @openapi comments.

Create Dockerfile if the module runs as a separate service (e.g. worker).

6. Naming and Code Conventions

Service: XxxService

Controller: XxxController

DTO: XxxDto

Test file: same name + .spec.ts

Queue name: <module>Queue (e.g. workflowQueue)

Env variables: must be documented in .env.example

7. Deliverables

auth.service.ts (login/signup, JWT handling)

workflow.service.ts (flow CRUD)

worker.ts (BullMQ consumer)

workflow.spec.ts (unit tests)

swagger inline documentation

8. Testing Standards

Use Jest for testing.

Every test must include:

A success case

An error case

A boundary or invalid input case

9. Example Prompt for Cursor

Using docs/workflow_requirements.md as context, generate Jest unit tests for WorkflowService following TDD. The tests should cover create, update, and execute methods.