import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom exception for resource not found
 */
export class NotFoundException extends HttpException {
  constructor(resource: string, id?: number | string) {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(message, HttpStatus.NOT_FOUND);
  }
}

/**
 * Custom exception for unauthorized access
 */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized access') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Custom exception for forbidden access
 */
export class ForbiddenException extends HttpException {
  constructor(message = 'You do not have permission to access this resource') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

/**
 * Custom exception for bad requests
 */
export class BadRequestException extends HttpException {
  constructor(message: string, details?: any) {
    const response: any = { message };
    if (details) {
      response.details = details;
    }
    super(response, HttpStatus.BAD_REQUEST);
  }
}

/**
 * Custom exception for conflicts (e.g., duplicate entries)
 */
export class ConflictException extends HttpException {
  constructor(message: string, resource?: string) {
    const fullMessage = resource
      ? `${resource} already exists: ${message}`
      : message;
    super(fullMessage, HttpStatus.CONFLICT);
  }
}

/**
 * Custom exception for workflow-specific errors
 */
export class WorkflowException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, statusCode);
  }
}

/**
 * Custom exception for execution errors
 */
export class ExecutionException extends HttpException {
  constructor(message: string, executionId?: number) {
    const fullMessage = executionId
      ? `Execution ${executionId} failed: ${message}`
      : `Execution failed: ${message}`;
    super(fullMessage, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
