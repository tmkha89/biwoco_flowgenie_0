import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  constructor(private configService: ConfigService) {
    let redisUrl = this.configService.get<string>('REDIS_URL');

    // If REDIS_URL is not provided, build it from REDIS_HOST and REDIS_PORT
    if (!redisUrl) {
      const redisHost = this.configService.get<string>('REDIS_HOST');
      const redisPort = this.configService.get<string>('REDIS_PORT', '6379');

      if (!redisHost) {
        throw new Error(
          'Either REDIS_URL or REDIS_HOST environment variable must be set. ' +
            'Please set REDIS_URL (e.g., redis://localhost:6379) or REDIS_HOST (e.g., localhost).',
        );
      }

      redisUrl = `redis://${redisHost}:${redisPort}`;
    } else {
      // Parse REDIS_URL and replace hostname if needed when running locally
      try {
        const url = new URL(redisUrl);
        const hostname = url.hostname;

        // If hostname is 'redis' (Docker service name) and we're not in Docker,
        // replace it with REDIS_HOST env var or throw error if not set
        if (hostname === 'redis') {
          const isRunningInDocker =
            process.env.DOCKER_CONTAINER === 'true' ||
            process.env.IN_DOCKER === 'true' ||
            process.env.RUNNING_IN_DOCKER === 'true';

          if (!isRunningInDocker) {
            const redisHost = this.configService.get<string>('REDIS_HOST');
            if (!redisHost) {
              throw new Error(
                'REDIS_HOST environment variable is required when running locally with REDIS_URL containing hostname "redis". ' +
                  'Please set REDIS_HOST to your Redis hostname (e.g., localhost) or update REDIS_URL directly.',
              );
            }
            url.hostname = redisHost;
            redisUrl = url.toString();
          }
        }
      } catch (error) {
        // If URL parsing fails, use as-is (might be a valid connection string format)
        if (error instanceof TypeError) {
          // Invalid URL format, might be using old format, just use it
        } else {
          throw error;
        }
      }
    }

    this.client = createClient({
      url: redisUrl,
    });
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.disconnect();
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.setEx(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }
}
