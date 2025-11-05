import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  details?: any;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;
    let details: any = undefined;

    // Handle HttpException (NestJS built-in exceptions)
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.constructor.name;

        // If validation errors, include details
        if (Array.isArray(responseObj.message)) {
          details = responseObj.message;
        }
      } else {
        message = exception.message;
      }

      error = error || exception.constructor.name;
    }
    // Handle Prisma errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, error, details } = this.handlePrismaError(exception));
    }
    // Handle Prisma validation errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'ValidationError';
      details = this.extractPrismaValidationDetails(exception.message);
    }
    // Handle Prisma client initialization errors
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Database connection error. Please try again later.';
      error = 'DatabaseError';
      this.logger.error('Prisma initialization error:', exception);
    }
    // Handle Prisma client runtime errors
    else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected database error occurred';
      error = 'DatabaseError';
      this.logger.error('Prisma runtime panic:', exception);
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message || 'An unexpected error occurred';
      error = exception.constructor.name || 'InternalServerError';

      // Log unexpected errors
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `Unexpected error: ${exception.message}`,
          exception.stack,
        );
      }
    }
    // Handle unknown errors
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'InternalServerError';
      this.logger.error('Unknown error:', exception);
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      ...(error && { error }),
      ...(details && { details }),
    };

    // Log the error with detailed information
    this.logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.error(`❌ Exception occurred: ${request.method} ${request.url}`);
    this.logger.error(`Status Code: ${status}`);
    this.logger.error(`Error Message: ${message}`);
    this.logger.error(`Error Type: ${error || exception?.constructor?.name || 'Unknown'}`);
    
    if (exception instanceof Error) {
      this.logger.error(`Error Name: ${exception.name}`);
      this.logger.error(`Error Message: ${exception.message}`);
      if (exception.stack) {
        this.logger.error('Error Stack:');
        this.logger.error(exception.stack);
      }
    }
    
    if (details) {
      this.logger.error(`Error Details: ${JSON.stringify(details, null, 2)}`);
    }
    
    // Log request details for debugging
    this.logger.error('Request Details:');
    this.logger.error(`  Method: ${request.method}`);
    this.logger.error(`  URL: ${request.url}`);
    this.logger.error(`  Path: ${request.path}`);
    this.logger.error(`  Query: ${JSON.stringify(request.query)}`);
    this.logger.error(`  Body: ${JSON.stringify(request.body || {})}`);
    this.logger.error(`  Headers: ${JSON.stringify(request.headers)}`);
    this.logger.error(`  IP: ${request.ip}`);
    this.logger.error(`  User Agent: ${request.get('User-Agent') || 'unknown'}`);
    this.logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    response.status(status).json(errorResponse);
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
    details?: any;
  } {
    let status: number;
    let message: string;
    let error: string;
    let details: any = undefined;

    switch (exception.code) {
      case 'P2000':
        status = HttpStatus.BAD_REQUEST;
        message = 'The provided value is too long for the field.';
        error = 'ValueTooLong';
        break;

      case 'P2001':
        status = HttpStatus.NOT_FOUND;
        message = 'The record you are looking for does not exist.';
        error = 'RecordNotFound';
        break;

      case 'P2002':
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[]) || [];
        const field = target.join(', ');
        message = `A record with this ${field} already exists.`;
        error = 'UniqueConstraintViolation';
        details = { field };
        break;

      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message =
          'The foreign key constraint failed. Related record does not exist.';
        error = 'ForeignKeyConstraintViolation';
        break;

      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message =
          'The record you are trying to update or delete does not exist.';
        error = 'RecordNotFound';
        break;

      case 'P2014':
        status = HttpStatus.BAD_REQUEST;
        message =
          'The change you are trying to make would violate a required relation.';
        error = 'RequiredRelationViolation';
        break;

      case 'P2011':
        status = HttpStatus.BAD_REQUEST;
        message = 'A null constraint violation occurred.';
        error = 'NullConstraintViolation';
        break;

      case 'P2012':
        status = HttpStatus.BAD_REQUEST;
        message = 'Missing a required value.';
        error = 'MissingRequiredValue';
        break;

      case 'P2013':
        status = HttpStatus.BAD_REQUEST;
        message = 'Missing the required argument.';
        error = 'MissingRequiredArgument';
        details = { argument: exception.meta?.target };
        break;

      case 'P2015':
        status = HttpStatus.NOT_FOUND;
        message = 'A related record could not be found.';
        error = 'RelatedRecordNotFound';
        break;

      case 'P2018':
        status = HttpStatus.BAD_REQUEST;
        message = 'The required connected records were not found.';
        error = 'ConnectedRecordsNotFound';
        break;

      case 'P2019':
        status = HttpStatus.BAD_REQUEST;
        message = 'Input error.';
        error = 'InputError';
        details = exception.meta;
        break;

      case 'P2020':
        status = HttpStatus.BAD_REQUEST;
        message = 'Value out of range for the type.';
        error = 'ValueOutOfRange';
        break;

      case 'P2021':
        status = HttpStatus.NOT_FOUND;
        message = 'The table does not exist in the current database.';
        error = 'TableNotFound';
        break;

      case 'P2022':
        status = HttpStatus.NOT_FOUND;
        message = 'The column does not exist in the current database.';
        error = 'ColumnNotFound';
        break;

      default:
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'A database error occurred.';
        error = 'DatabaseError';
        this.logger.error(
          `Unhandled Prisma error code: ${exception.code}`,
          exception,
        );
    }

    return { status, message, error, details };
  }

  private extractPrismaValidationDetails(message: string): string[] {
    // Extract field names from Prisma validation errors
    const fieldMatches = message.match(/Unknown argument `(\w+)`/g);
    if (fieldMatches) {
      return fieldMatches.map((match) => {
        const fieldName = match.match(/`(\w+)`/)?.[1];
        return `Invalid field: ${fieldName}`;
      });
    }
    return [message];
  }
}
