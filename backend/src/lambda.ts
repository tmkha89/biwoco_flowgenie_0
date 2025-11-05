import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Handler, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ValidationPipe } from '@nestjs/common';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const express = require('express');
const awsServerlessExpress = require('aws-serverless-express');

let server: any;

async function bootstrap(): Promise<any> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  
  const app = await NestFactory.create(AppModule, adapter);
  
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  // Setup Swagger documentation
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    try {
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

      console.log('📚 Swagger documentation available at /api/docs');
      console.log('📄 Swagger JSON spec available at /api/docs-json');
    } catch (error) {
      console.error('Failed to setup Swagger:', error);
    }
  } else {
    console.log('ℹ️  Swagger documentation is disabled (ENABLE_SWAGGER=false)');
  }
  
  await app.init();
  
  return awsServerlessExpress.createServer(expressApp);
}

export const handler: Handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  try {
    if (!server) {
      server = await bootstrap();
    }
    
    return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      }),
    };
  }
};
