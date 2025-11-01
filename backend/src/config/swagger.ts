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
  const port = process.env.PORT || '3000';

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
      description: packageJson.description || 'FlowGenie backend API documentation',
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

