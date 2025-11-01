# Authentication Setup Guide

This document describes the complete authentication system implemented for FlowGenie backend.

## Overview

The authentication system uses:
- **Google OAuth2** for social login
- **JWT** for access tokens (1h expiration)
- **Refresh tokens** for session management (7d expiration)
- **PostgreSQL** for user and token storage
- **Redis** for fast token lookup and caching

## Architecture

### Modules

1. **AuthModule** - Main authentication module
   - Handles Google OAuth2 flow
   - Generates JWT and refresh tokens
   - Manages token refresh and logout

2. **UsersModule** - User management
   - Creates/updates users
   - User profile management

3. **OAuthModule** - OAuth account linking
   - Stores OAuth provider accounts
   - Links multiple OAuth providers to users

### Database Schema

```prisma
model User {
  id            Int
  email         String @unique
  name          String?
  avatar        String?
  createdAt     DateTime
  updatedAt     DateTime
  oauthAccounts OAuthAccount[]
  refreshTokens RefreshToken[]
}

model OAuthAccount {
  id             Int
  userId         Int
  provider       String        // 'google', 'facebook', etc.
  providerUserId String
  accessToken    String?
  refreshToken   String?
  expiresAt      DateTime?
  createdAt      DateTime
  updatedAt      DateTime
}

model RefreshToken {
  id        Int
  userId    Int
  token     String @unique
  expiresAt DateTime
  revoked   Boolean
  createdAt DateTime
}
```

## API Endpoints

### Authentication Flow

#### 1. Initiate Google Login
```
GET /auth/google
```
Redirects to Google OAuth consent screen.

#### 2. OAuth Callback
```
GET /auth/google/callback?code=xxx
```
Handles Google OAuth callback and returns tokens:

**Response:**
```json
{
  "access_token": "jwt-token",
  "refresh_token": "refresh-token",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "avatar": "https://..."
  }
}
```

#### 3. Refresh Access Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "refresh-token"
}
```

**Response:**
```json
{
  "access_token": "new-jwt-token",
  "expires_in": 3600
}
```

#### 4. Logout
```
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refresh_token": "refresh-token"
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

#### 5. Get Current User
```
GET /auth/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "avatar": "https://..."
}
```

## Environment Variables

Required environment variables (see `backend/env.template`):

```bash
# Application
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=604800  # 7 days in seconds

# Google OAuth2
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy Client ID and Secret to `.env`

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 4. Run with Docker Compose

```bash
# Development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up

# Production
docker-compose up -d
```

## Usage Examples

### Frontend Integration

#### Login Flow

```javascript
// 1. Redirect to Google OAuth
window.location.href = 'http://localhost:3000/auth/google';

// 2. Handle callback (in popup or redirect)
// The callback endpoint returns an HTML page that posts a message to window.opener

window.addEventListener('message', (event) => {
  if (event.data.type === 'OAUTH_SUCCESS') {
    const { access_token, refresh_token, user } = event.data.data;
    // Store tokens
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    // Update UI with user info
  }
});
```

#### Making Authenticated Requests

```javascript
const accessToken = localStorage.getItem('access_token');

fetch('http://localhost:3000/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
})
  .then(res => res.json())
  .then(user => console.log(user));
```

#### Refresh Token Flow

```javascript
async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('http://localhost:3000/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  const { access_token } = await response.json();
  localStorage.setItem('access_token', access_token);
}
```

## Security Features

1. **JWT Tokens** - Signed and verified with secret key
2. **Refresh Token Rotation** - Refresh tokens stored in database and Redis
3. **Token Revocation** - Logout revokes refresh tokens
4. **HTTPS Support** - Handles self-signed certificates in Docker
5. **Input Validation** - DTOs validate all inputs
6. **Protected Routes** - JWT guard protects sensitive endpoints

## Testing

```bash
# Run unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

Tests are available for:
- `AuthService` - Authentication logic
- `AuthController` - API endpoints

## Troubleshooting

### OAuth Callback Issues

- Verify `GOOGLE_REDIRECT_URI` matches Google Console settings
- Check that redirect URI is added to authorized URIs in Google Console
- Ensure `APP_URL` matches your frontend URL

### Database Connection Issues

- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/dbname`
- Check PostgreSQL is running: `docker-compose ps db`
- Run migrations: `npm run prisma:migrate`

### Redis Connection Issues

- Verify `REDIS_URL` format: `redis://host:port`
- Check Redis is running: `docker-compose ps redis`
- Test connection: `redis-cli ping`

### JWT Token Issues

- Verify `JWT_SECRET` is set and secure
- Check token expiration times
- Ensure `Authorization: Bearer <token>` header is sent

## Next Steps

- [ ] Add email/password authentication
- [ ] Add password reset flow
- [ ] Add 2FA support
- [ ] Add session management UI
- [ ] Add rate limiting
- [ ] Add audit logging

