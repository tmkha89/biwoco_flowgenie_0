import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local first (if exists), then .env as fallback
// This ensures .env.local takes precedence before NestJS ConfigModule loads
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (require('fs').existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/http-exception.filter';
import * as fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

async function bootstrap() {
  const configService = new ConfigService();
  const port = configService.get<number>('PORT', 3000);

  // Check if running in Docker or local with HTTPS cert
  const certPath = '/usr/src/app/certs/localhost.pem';
  const keyPath = '/usr/src/app/certs/localhost-key.pem';
  const localCertPath = './certs/localhost.pem';
  const localKeyPath = './certs/localhost-key.pem';

  // Try to find certificate files
  let certFile: string | undefined;
  let keyFile: string | undefined;
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    certFile = certPath;
    keyFile = keyPath;
  } else if (fs.existsSync(localCertPath) && fs.existsSync(localKeyPath)) {
    certFile = localCertPath;
    keyFile = localKeyPath;
  } else if (fs.existsSync(certPath)) {
    // Fallback: use same file for both cert and key (for self-signed certs)
    certFile = certPath;
    keyFile = certPath;
  } else if (fs.existsSync(localCertPath)) {
    certFile = localCertPath;
    keyFile = localCertPath;
  }

  // Create app with HTTPS options if certs are available
  // Enable console logger to output all logs to terminal
  const logger = new Logger('Bootstrap');
  const loggerOptions = {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'] as LogLevel[], // Enable all log levels
  };
  
  let app;
  if (certFile && keyFile) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(keyFile),
        cert: fs.readFileSync(certFile),
      };
      app = await NestFactory.create(AppModule, { 
        httpsOptions,
        ...loggerOptions,
      });
      logger.log('🔒 HTTPS enabled with local certificates');
    } catch (error) {
      logger.warn('⚠️  Failed to load HTTPS certs, starting HTTP server');
      app = await NestFactory.create(AppModule, loggerOptions);
    }
  } else {
    app = await NestFactory.create(AppModule, loggerOptions);
  }
  
  // Use the default logger to ensure all logs go to console
  app.useLogger(new Logger());

  // Enable CORS for OAuth callbacks and Swagger UI
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',')
    : [process.env.APP_URL || 'http://localhost:3000', process.env.FRONTEND_URL || 'http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        // Format validation errors for better readability
        const messages = errors.map((error) => {
          const constraints = Object.values(error.constraints || {});
          return constraints.length > 0
            ? `${error.property}: ${constraints.join(', ')}`
            : `${error.property}: invalid value`;
        });
        const BadRequestException = require('@nestjs/common').BadRequestException;
        return new BadRequestException({
          message: 'Validation failed',
          details: messages,
        });
      },
    }),
  );

  // Setup Swagger documentation
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    // Get the underlying Express instance to use Express middleware
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance();

    instance.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'FlowGenie API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      },
      customCssUrl: undefined,
    }));

    // Serve Swagger JSON spec
    instance.get('/api/docs-json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(swaggerSpec);
    });

    console.log('📚 Swagger documentation available at /api/docs');
    console.log('📄 Swagger JSON spec available at /api/docs-json');
  } else {
    console.log('ℹ️  Swagger documentation is disabled (ENABLE_SWAGGER=false)');
  }

  await app.listen(port);
  const protocol = certFile && keyFile ? 'https' : 'http';
  console.log(`🚀 Application is running on: ${protocol}://localhost:${port}`);
}

bootstrap();

