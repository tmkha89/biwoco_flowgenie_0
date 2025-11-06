import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Connect to database with timeout to prevent blocking app startup
    // This is critical for App Runner health checks - the app must start quickly
    this.logger.log('Attempting to connect to database...');
    
    const connectPromise = this.$connect();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 5000)
    );

    try {
      await Promise.race([connectPromise, timeoutPromise]);
      this.logger.log('✅ Database connection established');
    } catch (error) {
      this.logger.warn(`⚠️ Database connection failed or timed out: ${error.message}`);
      this.logger.warn('Application will continue to start, but database features may be unavailable');
      // Don't throw - allow app to start even if database is not ready
      // This is important for App Runner health checks
      // Connection will be retried on first database query
    } finally {
      this.logger.log('Database connection attempt completed (onModuleInit finished)');
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch (error) {
      this.logger.warn(`Error disconnecting from database: ${error.message}`);
    }
  }
}
