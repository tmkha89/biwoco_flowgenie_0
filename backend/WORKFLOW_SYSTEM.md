# Workflow System Documentation

## Overview

The workflow system is a modular, event-driven workflow engine built with NestJS, TypeScript, Prisma, and BullMQ. Each workflow consists of ordered steps ("actions") that are triggered by external events (Google API events, HTTP triggers, manual triggers, etc.).

## Architecture

The system follows clean architecture principles with clear separation between:
- **Domain Layer**: Interfaces and business logic
- **Application Layer**: Services and use cases
- **Infrastructure Layer**: Repositories, queues, and external integrations
- **Presentation Layer**: Controllers and DTOs

## Core Components

### 1. Database Models (Prisma Schema)

The following models are defined in `prisma/schema.prisma`:

- **Workflow**: Main workflow entity with name, description, enabled status
- **Trigger**: Defines what triggers the workflow (manual, webhook, google, schedule)
- **Action**: Individual steps in the workflow (slack_message, gmail_send, etc.)
- **Execution**: Represents a single run of a workflow
- **ExecutionStep**: Individual step execution within a workflow run

### 2. Services

#### WorkflowService (`/src/workflows/workflow.service.ts`)
- Creates and manages workflows
- Registers/unregisters triggers
- Queues workflow executions

#### ExecutionService (`/src/workflows/execution.service.ts`)
- Executes workflows step by step
- Handles retry logic for failed steps
- Updates execution and step statuses

### 3. Repositories

#### WorkflowRepository (`/src/workflows/repositories/workflow.repository.ts`)
- Database operations for workflows, triggers, and actions

#### ExecutionRepository (`/src/workflows/repositories/execution.repository.ts`)
- Database operations for executions and execution steps

### 4. Registries

#### TriggerRegistry (`/src/workflows/triggers/trigger.registry.ts`)
- Manages trigger handlers
- Registers/unregisters triggers

#### ActionRegistry (`/src/workflows/actions/action.registry.ts`)
- Manages action handlers
- Provides lookup by action type

### 5. Handlers

#### Trigger Handlers
- **ManualTriggerHandler**: Manual API-triggered workflows
- **WebhookTriggerHandler**: HTTP webhook-triggered workflows

#### Action Handlers
- **ExampleActionHandler**: Example action implementation
- **BaseActionHandler**: Base class for custom actions

### 6. Worker

#### WorkflowWorker (`/src/workers/workflow.worker.ts`)
- BullMQ worker that processes workflow execution jobs
- Creates NestJS application context to access services
- Handles job failures and retries

## API Endpoints

All endpoints are under `/workflows` and require JWT authentication:

### Workflow Management

- `POST /workflows` - Create a new workflow
- `GET /workflows` - List all workflows for the current user
- `GET /workflows/:id` - Get workflow details
- `PUT /workflows/:id` - Update workflow
- `DELETE /workflows/:id` - Delete workflow

### Workflow Execution

- `POST /workflows/:id/trigger` - Manually trigger a workflow
- `GET /workflows/:id/executions` - Get execution history for a workflow
- `GET /workflows/executions/history` - Get execution history for all workflows
- `GET /workflows/executions/:executionId` - Get execution details

## Creating Custom Actions

To create a new action handler:

1. **Create Action Handler Class**:

```typescript
import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

@Injectable()
export class MyCustomActionHandler extends BaseActionHandler {
  readonly type = 'my_custom_action';
  readonly name = 'My Custom Action';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    // Your action logic here
    // Access trigger data: this.getTriggerData(context)
    // Access previous step results: this.getStepResult(context, actionId)
    
    return { result: 'success' };
  }

  validateConfig(config: Record<string, any>): boolean {
    // Validate configuration
    return true;
  }
}
```

2. **Register in WorkflowModule**:

```typescript
// In workflow.module.ts
import { MyCustomActionHandler } from './actions/my-custom.action';

@Module({
  providers: [
    // ... existing providers
    MyCustomActionHandler,
    {
      provide: 'ACTION_HANDLER_REGISTRATION',
      useFactory: (
        actionRegistry: ActionRegistry,
        // ... existing handlers
        myCustomAction: MyCustomActionHandler,
      ) => {
        actionRegistry.registerHandler(myCustomAction);
        return true;
      },
      inject: [ActionRegistry, /* ... existing handlers */, MyCustomActionHandler],
    },
  ],
})
export class WorkflowModule {}
```

## Creating Custom Triggers

To create a new trigger handler:

1. **Create Trigger Handler Class**:

```typescript
import { Injectable } from '@nestjs/common';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';

@Injectable()
export class MyCustomTriggerHandler implements ITriggerHandler {
  readonly type: TriggerType = TriggerType.CUSTOM;
  readonly name = 'My Custom Trigger';

  async validate(config: Record<string, any>): Promise<boolean> {
    // Validate configuration
    return true;
  }

  async register(workflowId: number, config: Record<string, any>): Promise<void> {
    // Set up trigger (e.g., subscribe to events, create webhook)
  }

  async unregister(workflowId: number): Promise<void> {
    // Clean up trigger (e.g., unsubscribe from events, delete webhook)
  }
}
```

2. **Register in WorkflowModule** (similar to action handlers)

## Execution Flow

1. **Trigger**: Workflow is triggered (manual, webhook, event, etc.)
2. **Execution Creation**: An Execution record is created with status "pending"
3. **Queue Job**: Job is added to BullMQ queue
4. **Worker Processing**: Worker picks up the job
5. **Step Execution**: Each action is executed sequentially:
   - Create ExecutionStep record
   - Update status to "running"
   - Execute action handler
   - Update status to "completed" or "failed"
   - Retry on failure (if configured)
6. **Completion**: Execution status updated to "completed" or "failed"

## Retry Logic

Each action can have retry configuration:

```typescript
{
  attempts: 3,  // Maximum number of retry attempts
  backoff: {
    type: 'exponential',  // or 'fixed'
    delay: 2000  // Base delay in milliseconds
  }
}
```

- **Fixed backoff**: Retry after a fixed delay
- **Exponential backoff**: Delay doubles with each retry (2s, 4s, 8s, ...)

## Testing

Test stubs are provided following TDD principles:

- `workflow.service.spec.ts` - Tests for WorkflowService
- `execution.service.spec.ts` - Tests for ExecutionService
- `workflow.controller.spec.ts` - Tests for WorkflowController

Run tests with:
```bash
npm test
npm run test:watch
npm run test:cov
```

## Database Migration

After updating the Prisma schema, generate and apply migrations:

```bash
# Generate Prisma client
npm run prisma:generate

# Create and apply migration
npm run prisma:migrate
```

## Running Workers

Workers run as a separate process:

```bash
# Development
npm run worker

# Production
npm run worker:prod
```

## Environment Variables

Required environment variables (in `.env.local`):

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://localhost:6379
```

## File Structure

```
backend/src/workflows/
├── actions/                 # Action handlers
│   ├── base.action.ts       # Base action class
│   ├── example.action.ts    # Example action
│   └── action.registry.ts   # Action registry
├── triggers/                 # Trigger handlers
│   ├── manual.trigger.ts    # Manual trigger
│   ├── webhook.trigger.ts   # Webhook trigger
│   └── trigger.registry.ts  # Trigger registry
├── repositories/             # Data access layer
│   ├── workflow.repository.ts
│   └── execution.repository.ts
├── dto/                      # Data transfer objects
│   ├── create-workflow.dto.ts
│   ├── workflow-response.dto.ts
│   └── trigger-workflow.dto.ts
├── interfaces/               # Type definitions
│   └── workflow.interface.ts
├── decorators/               # Decorators
│   └── action-handler.decorator.ts
├── workflow.controller.ts    # REST API controller
├── workflow.service.ts       # Workflow business logic
├── execution.service.ts       # Execution business logic
├── workflow.module.ts         # NestJS module
└── *.spec.ts                  # Test files
```

## Extensibility

The system is designed to be extensible:

1. **New Actions**: Create action handler class and register in module
2. **New Triggers**: Create trigger handler class and register in module
3. **Custom Logic**: Extend BaseActionHandler or implement IActionHandler
4. **External Integrations**: Add handlers for Slack, Gmail, Notion, etc.

All core logic remains unchanged when adding new actions or triggers.

