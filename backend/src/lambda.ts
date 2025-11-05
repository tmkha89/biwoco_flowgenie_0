import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Handler, Context, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ValidationPipe } from '@nestjs/common';

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
  
  await app.init();
  
  return awsServerlessExpress.createServer(expressApp);
}

export const handler: Handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  if (!server) {
    server = await bootstrap();
  }
  
  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};
