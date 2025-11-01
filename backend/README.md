# FlowGenie Backend

NestJS backend service for FlowGenie with Google OAuth2 authentication.

## Features

- ✅ Google OAuth2 authentication
- ✅ JWT access tokens (1h expiration)
- ✅ Refresh tokens (7d expiration)
- ✅ PostgreSQL database with Prisma ORM
- ✅ Redis caching for session management
- ✅ Clean architecture with repository pattern
- ✅ Unit tests with Jest

## Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15
- Redis 7

### Environment Variables

Copy `env.template` to `.env` and configure:

```bash
cp env.template .env
```

Required variables:
- `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth callback URL (e.g., `http://localhost:3000/auth/google/callback`)
- `JWT_SECRET` - Secret key for JWT signing
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### Running the Application

#### Development (Local)

```bash
# Install dependencies
npm install

# Start with Docker Compose
docker-compose -f ../docker-compose.yml -f ../docker-compose.override.yml up

# Or run locally
npm run start:dev
```

#### Production

```bash
docker-compose up -d
```

## API Endpoints

### Authentication

- `GET /auth/google` - Redirect to Google OAuth
- `GET /auth/google/callback` - OAuth callback handler
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and revoke refresh token
- `GET /auth/me` - Get current user (protected)

### Users

- `GET /users/me` - Get current user profile (protected)

## Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

## Architecture

```
src/
├── auth/              # Authentication module
│   ├── dto/          # Data Transfer Objects
│   ├── guards/       # JWT guard
│   ├── strategies/   # Passport strategies
│   ├── services/     # Business logic
│   └── repositories/ # Data access
├── users/             # Users module
├── oauth/             # OAuth accounts module
└── database/          # Database services (Prisma, Redis)
```

## License

UNLICENSED

