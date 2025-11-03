import { Module, Inject } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { WorkflowRepository } from './repositories/workflow.repository';
import { ExecutionRepository } from './repositories/execution.repository';
import { WorkflowRelationshipHelper } from './repositories/workflow.relationship.helper';
import { TriggerRegistry } from './triggers/trigger.registry';
import { ActionRegistry } from './actions/action.registry';
import { ActionFactory } from './actions/action.factory';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { Queue } from 'bullmq';
import { getRedisConnectionObject } from '../queues/queue.config';

// Services
import { WorkflowEventService } from './services/workflow-event.service';
import { GmailService } from './services/gmail.service';

// Trigger handlers
import { ManualTriggerHandler } from './triggers/manual.trigger';
import { WebhookTriggerHandler } from './triggers/webhook.trigger';
import { GoogleMailTriggerHandler } from './triggers/google-mail.trigger';
import { ScheduleTriggerHandler } from './triggers/schedule.trigger';

// Controllers
import { TriggerController } from './controllers/trigger.controller';

// Listeners
import { WorkflowTriggerListener } from './listeners/workflow-trigger.listener';

// Action handlers
import { ExampleActionHandler } from './actions/example.action';
import { HttpActionHandler } from './actions/http.action';
import { EmailActionHandler } from './actions/email.action';
import { WaitActionHandler } from './actions/wait.action';
import { ConditionalActionHandler } from './actions/conditional.action';
import { LoopActionHandler } from './actions/loop.action';
import { ParallelActionHandler } from './actions/parallel.action';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [WorkflowController, TriggerController],
  providers: [
    WorkflowService,
    ExecutionService,
    WorkflowRepository,
    ExecutionRepository,
    WorkflowRelationshipHelper,
    TriggerRegistry,
    ActionRegistry,
    ActionFactory,
    // Services
    WorkflowEventService,
    GmailService,
    // Trigger handlers
    ManualTriggerHandler,
    WebhookTriggerHandler,
    GoogleMailTriggerHandler,
    ScheduleTriggerHandler,
    // Listeners
    WorkflowTriggerListener,
    // Schedule queue (optional, for distributed scheduling)
    {
      provide: 'WORKFLOW_SCHEDULE_QUEUE',
      useFactory: () => {
        try {
          return new Queue('workflow-schedule', {
            connection: getRedisConnectionObject(),
          });
        } catch (error) {
          // If Redis is not available, return null
          console.warn('Failed to create schedule queue, using in-memory scheduling only');
          return null;
        }
      },
    },
    // Action handlers
    ExampleActionHandler,
    HttpActionHandler,
    EmailActionHandler,
    WaitActionHandler,
    ConditionalActionHandler,
    LoopActionHandler,
    ParallelActionHandler,
    // Workflow queue
    {
      provide: 'WORKFLOW_QUEUE',
      useFactory: () => {
        return new Queue('workflow-execution', {
          connection: getRedisConnectionObject(),
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 3600, // Keep completed jobs for 1 hour
              count: 1000, // Keep last 1000 completed jobs
            },
            removeOnFail: {
              age: 24 * 3600, // Keep failed jobs for 24 hours
            },
          },
        });
      },
    },
    // Register trigger handlers
    {
      provide: 'TRIGGER_HANDLER_REGISTRATION',
      useFactory: (
        triggerRegistry: TriggerRegistry,
        manualTrigger: ManualTriggerHandler,
        webhookTrigger: WebhookTriggerHandler,
        googleMailTrigger: GoogleMailTriggerHandler,
        scheduleTrigger: ScheduleTriggerHandler,
      ) => {
        triggerRegistry.registerHandler(manualTrigger);
        triggerRegistry.registerHandler(webhookTrigger);
        triggerRegistry.registerHandler(googleMailTrigger);
        triggerRegistry.registerHandler(scheduleTrigger);
        return true;
      },
      inject: [
        TriggerRegistry,
        ManualTriggerHandler,
        WebhookTriggerHandler,
        GoogleMailTriggerHandler,
        ScheduleTriggerHandler,
      ],
    },
    // Register action handlers
    {
      provide: 'ACTION_HANDLER_REGISTRATION',
      useFactory: (
        actionRegistry: ActionRegistry,
        exampleAction: ExampleActionHandler,
        httpAction: HttpActionHandler,
        emailAction: EmailActionHandler,
        waitAction: WaitActionHandler,
        conditionalAction: ConditionalActionHandler,
        loopAction: LoopActionHandler,
        parallelAction: ParallelActionHandler,
      ) => {
        actionRegistry.registerHandler(exampleAction);
        actionRegistry.registerHandler(httpAction);
        actionRegistry.registerHandler(emailAction);
        actionRegistry.registerHandler(waitAction);
        actionRegistry.registerHandler(conditionalAction);
        actionRegistry.registerHandler(loopAction);
        actionRegistry.registerHandler(parallelAction);
        return true;
      },
      inject: [
        ActionRegistry,
        ExampleActionHandler,
        HttpActionHandler,
        EmailActionHandler,
        WaitActionHandler,
        ConditionalActionHandler,
        LoopActionHandler,
        ParallelActionHandler,
      ],
    },
  ],
  exports: [WorkflowService, ExecutionService, ActionRegistry, TriggerRegistry],
})
export class WorkflowModule {
  constructor(
    @Inject('WORKFLOW_QUEUE') private readonly workflowQueue: Queue,
    private readonly actionRegistry: ActionRegistry,
    private readonly triggerRegistry: TriggerRegistry,
  ) {
    // Log registered handlers on module initialization
    console.log('[WorkflowModule] Registered action types:', this.actionRegistry.getRegisteredTypes());
  }

  async onModuleDestroy() {
    // Clean up queue connection
    await this.workflowQueue.close();
  }
}

