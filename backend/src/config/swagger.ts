// src/config/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';
import * as fs from 'fs';
import * as path from 'path';

// Read package.json for API info
// Handle both development (src/config) and production (dist/config) paths
const packageJsonPath = path.join(process.cwd(), 'package.json');
let packageJson: any;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  // Fallback if package.json not found
  packageJson = {
    name: 'flowgenie-backend',
    version: '1.0.0',
    description: 'FlowGenie backend API documentation',
  };
}

// Determine base URL based on environment
const getBaseUrl = (): string => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  if (nodeEnv === 'production') {
    return process.env.API_URL || appUrl;
  } else if (nodeEnv === 'staging') {
    return process.env.STAGING_API_URL || appUrl;
  } else {
    // Development
    return appUrl;
  }
};

const baseUrl = getBaseUrl();

// Swagger options
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowGenie API Docs',
      version: packageJson.version || '1.0.0',
      description:
        packageJson.description || 'FlowGenie backend API documentation',
      contact: {
        name: 'FlowGenie API Support',
      },
    },
    servers: [
      {
        url: baseUrl,
        description: `${process.env.NODE_ENV || 'development'} server`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from authentication endpoints',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            name: {
              type: 'string',
              example: 'John Doe',
            },
            avatar: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://example.com/avatar.jpg',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refresh_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            expires_in: {
              type: 'integer',
              example: 3600,
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refresh_token'],
          properties: {
            refresh_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        RetryConfig: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['fixed', 'exponential'],
              example: 'exponential',
            },
            delay: {
              type: 'integer',
              example: 2000,
              description: 'Delay in milliseconds',
            },
          },
        },
        CreateAction: {
          type: 'object',
          required: ['type', 'name', 'config', 'order'],
          properties: {
            type: {
              type: 'string',
              example: 'example_action',
              description: 'Action type identifier',
            },
            name: {
              type: 'string',
              example: 'Send Email',
              description: 'Human-readable action name',
            },
            config: {
              type: 'object',
              additionalProperties: true,
              example: { to: 'user@example.com', subject: 'Hello' },
            },
            order: {
              type: 'integer',
              example: 0,
              description: 'Execution order (0-based)',
            },
            retryConfig: {
              $ref: '#/components/schemas/RetryConfig',
            },
          },
        },
        CreateTrigger: {
          type: 'object',
          required: ['type', 'config'],
          properties: {
            type: {
              type: 'string',
              enum: ['google-mail', 'webhook', 'manual', 'schedule'],
              example: 'manual',
            },
            config: {
              type: 'object',
              additionalProperties: true,
              example: {},
            },
          },
        },
        CreateWorkflow: {
          type: 'object',
          required: ['name', 'trigger', 'actions'],
          properties: {
            name: {
              type: 'string',
              example: 'My Workflow',
            },
            description: {
              type: 'string',
              example: 'A sample workflow description',
            },
            enabled: {
              type: 'boolean',
              example: true,
              default: true,
            },
            trigger: {
              $ref: '#/components/schemas/CreateTrigger',
            },
            actions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CreateAction',
              },
            },
          },
        },
        TriggerResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            workflowId: {
              type: 'integer',
              example: 1,
            },
            type: {
              type: 'string',
              example: 'manual',
            },
            config: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        ActionResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            workflowId: {
              type: 'integer',
              example: 1,
            },
            type: {
              type: 'string',
              example: 'example_action',
            },
            name: {
              type: 'string',
              example: 'Send Email',
            },
            config: {
              type: 'object',
              additionalProperties: true,
            },
            order: {
              type: 'integer',
              example: 0,
            },
            retryConfig: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
        WorkflowResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'My Workflow',
            },
            description: {
              type: 'string',
              example: 'A sample workflow',
            },
            enabled: {
              type: 'boolean',
              example: true,
            },
            trigger: {
              $ref: '#/components/schemas/TriggerResponse',
            },
            actions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ActionResponse',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        ExecutionStepResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            executionId: {
              type: 'integer',
              example: 1,
            },
            actionId: {
              type: 'integer',
              example: 1,
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
              example: 'completed',
            },
            order: {
              type: 'integer',
              example: 0,
            },
            input: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            output: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            error: {
              type: 'string',
              nullable: true,
            },
            retryCount: {
              type: 'integer',
              example: 0,
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
        ExecutionResponse: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            workflowId: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              example: 'completed',
            },
            triggerData: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            result: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
            },
            error: {
              type: 'string',
              nullable: true,
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            executionSteps: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ExecutionStepResponse',
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TriggerWorkflow: {
          type: 'object',
          properties: {
            triggerData: {
              type: 'object',
              additionalProperties: true,
              nullable: true,
              example: { event: 'user_signup', userId: 123 },
            },
          },
        },
        UpdateWorkflow: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Updated Workflow Name',
            },
            description: {
              type: 'string',
              example: 'Updated description',
            },
            enabled: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Error message',
            },
            message: {
              type: 'string',
              example: 'Detailed error message',
            },
            statusCode: {
              type: 'integer',
              example: 400,
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Authentication',
        description: 'Authentication and authorization endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints',
      },
      {
        name: 'Workflows',
        description: 'Workflow management and execution endpoints',
      },
      {
        name: 'Triggers',
        description:
          'Trigger endpoints for webhooks and Gmail Pub/Sub notifications',
      },
    ],
  },
  apis: [
    // Auto-load from all controller files with JSDoc comments
    // Supports both TypeScript source files (dev) and compiled JS files (prod)
    path.join(process.cwd(), 'src/**/*.controller.ts'),
    path.join(process.cwd(), 'src/**/*.dto.ts'),
    path.join(process.cwd(), 'dist/**/*.controller.js'),
    path.join(process.cwd(), 'dist/**/*.dto.js'),
  ],
};

// Generate Swagger specification
export const swaggerSpec = swaggerJsdoc(swaggerOptions);
