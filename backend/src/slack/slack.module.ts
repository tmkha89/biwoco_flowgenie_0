import { Module, Inject } from '@nestjs/common';
import { SlackService } from './slack.service';
import { SlackController } from './slack.controller';
import { OAuthModule } from '../oauth/oauth.module';
import { Queue } from 'bullmq';
import { getRedisConnectionObject } from '../queues/queue.config';

/**
 * Slack Module
 * Handles Slack OAuth2 integration and Events API
 */
@Module({
  imports: [OAuthModule],
  controllers: [SlackController],
  providers: [
    SlackService,
    // Slack event queue
    {
      provide: 'SLACK_EVENT_QUEUE',
      useFactory: () => {
        return new Queue('slack-event', {
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
  ],
  exports: [SlackService],
})
export class SlackModule {
  constructor(
    @Inject('SLACK_EVENT_QUEUE') private readonly slackEventQueue: Queue,
  ) {}

  async onModuleDestroy() {
    // Clean up queue connection
    await this.slackEventQueue.close();
  }
}

