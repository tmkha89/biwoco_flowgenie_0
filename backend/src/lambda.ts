import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Handler, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { AllExceptionsFilter } from './common/exceptions/http-exception.filter';

const express = require('express');
const awsServerlessExpress = require('aws-serverless-express');

let server: any;

async function bootstrap(): Promise<any> {
  const logger = new Logger('LambdaBootstrap');
  
  try {
    logger.log('🚀 Initializing Lambda handler...');
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`Stage: ${process.env.STAGE || 'unknown'}`);
    
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);
    
    // Enable detailed logging - all log levels
    const loggerOptions = {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'] as LogLevel[],
    };
    
    logger.log('📦 Creating NestJS application...');
    const app = await NestFactory.create(AppModule, adapter, loggerOptions);
    
    // Use the default logger to ensure all logs go to console
    app.useLogger(new Logger());
    
    logger.log('🌐 Enabling CORS...');
    app.enableCors({
      origin: true, // Allow all origins in Lambda
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });
    
    logger.log('🛡️  Setting up global exception filter...');
    app.useGlobalFilters(new AllExceptionsFilter());
    
    logger.log('✅ Setting up global validation pipe...');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        disableErrorMessages: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    // Setup Swagger documentation
    const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
    if (enableSwagger) {
      try {
        logger.log('📚 Setting up Swagger documentation...');
        const httpAdapter = app.getHttpAdapter();
        const instance = httpAdapter.getInstance();

        instance.use(
          '/api/docs',
          swaggerUi.serve,
          swaggerUi.setup(swaggerSpec, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: 'FlowGenie API Docs',
            swaggerOptions: {
              persistAuthorization: true,
              displayRequestDuration: true,
              filter: true,
              showExtensions: true,
              showCommonExtensions: true,
            },
          }),
        );

        // Serve Swagger JSON spec
        instance.get('/api/docs-json', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.send(swaggerSpec);
        });

        logger.log('📚 Swagger documentation available at /api/docs');
        logger.log('📄 Swagger JSON spec available at /api/docs-json');
      } catch (error) {
        logger.error('❌ Failed to setup Swagger:', error);
        if (error instanceof Error) {
          logger.error('Error stack:', error.stack);
        }
      }
    } else {
      logger.log('ℹ️  Swagger documentation is disabled (ENABLE_SWAGGER=false)');
    }
    
    logger.log('⚙️  Initializing application...');
    await app.init();
    
    logger.log('✅ Lambda handler initialized successfully');
    
    return awsServerlessExpress.createServer(expressApp);
  } catch (error) {
    logger.error('❌ Failed to bootstrap Lambda handler:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    throw error;
  }
}

export const handler: Handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const logger = new Logger('LambdaHandler');
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Log request details
  logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.log(`📥 Incoming Request: ${event.httpMethod} ${event.path}`);
  logger.log(`Request ID: ${event.requestContext.requestId}`);
  logger.log(`Source IP: ${event.requestContext.identity?.sourceIp || 'unknown'}`);
  logger.log(`User Agent: ${event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown'}`);
  logger.log(`Query Parameters: ${JSON.stringify(event.queryStringParameters || {})}`);
  logger.log(`Path Parameters: ${JSON.stringify(event.pathParameters || {})}`);
  
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      logger.verbose(`Request Body: ${JSON.stringify(body)}`);
    } catch (e) {
      logger.verbose(`Request Body (raw): ${event.body.substring(0, 500)}`);
    }
  }
  
  try {
    if (!server) {
      logger.log('🔄 Server not initialized, bootstrapping...');
      server = await bootstrap();
      logger.log('✅ Server initialized');
    }
    
    logger.log('➡️  Proxying request to Express server...');
    const result = await awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
    
    logger.log(`✅ Response: ${result.statusCode} for ${event.httpMethod} ${event.path}`);
    if (result.statusCode && result.statusCode >= 400) {
      logger.warn(`⚠️  Error response: ${result.statusCode}`);
      if (result.body) {
        try {
          const errorBody = JSON.parse(result.body);
          logger.warn(`Error details: ${JSON.stringify(errorBody)}`);
        } catch (e) {
          logger.warn(`Error body (raw): ${result.body.substring(0, 500)}`);
        }
      }
    }
    
    return result;
  } catch (error) {
    logger.error('❌ Lambda handler error occurred:');
    logger.error(`Error type: ${error?.constructor?.name || typeof error}`);
    
    if (error instanceof Error) {
      logger.error(`Error message: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      logger.error(`Error name: ${error.name}`);
    } else {
      logger.error(`Error object: ${JSON.stringify(error)}`);
    }
    
    // Log environment info for debugging
    logger.error(`Environment: ${process.env.NODE_ENV || 'unknown'}`);
    logger.error(`Stage: ${process.env.STAGE || 'unknown'}`);
    logger.error(`Lambda context: ${JSON.stringify({
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      invokedFunctionArn: context.invokedFunctionArn,
      memoryLimitInMB: context.memoryLimitInMB,
      awsRequestId: context.awsRequestId,
      remainingTimeInMillis: context.getRemainingTimeInMillis(),
    })}`);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Internal server error',
        requestId: event.requestContext.requestId,
        timestamp: new Date().toISOString(),
        path: event.path,
        method: event.httpMethod,
        error: process.env.NODE_ENV === 'production' 
          ? undefined 
          : error instanceof Error 
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack,
              }
            : String(error),
      }),
    };
  }
};
