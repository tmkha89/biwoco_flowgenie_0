# FlowGenie

FlowGenie is a full-stack workflow automation platform that enables users to create, manage, and execute complex automated workflows with seamless integrations. Built with modern cloud-native technologies, FlowGenie provides a scalable, secure, and efficient solution for workflow automation.

## 🏗️ Project Overview

FlowGenie is a workflow automation platform that allows users to:

- **Design workflows** using a visual drag-and-drop interface
- **Execute workflows** automatically based on triggers and schedules
- **Integrate with external services** (Gmail, Slack, Google Calendar, and more)
- **Monitor workflow execution** with detailed logs and history
- **Manage user authentication** with JWT and OAuth2 (Google)

The platform is built as a serverless, cloud-native application leveraging AWS services for scalability, reliability, and cost-effectiveness. All endpoints and environments use SSL/TLS encryption, including local development.

## ⚙️ Tech Stack

### Frontend
- **React 18** - Modern UI library for building user interfaces
- **TypeScript** - Type-safe JavaScript for better code quality
- **Vite** - Fast build tool and dev server
- **React Flow** - Visual workflow builder component
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Axios** - HTTP client for API requests

### Backend
- **NestJS** - Progressive Node.js framework for building efficient server-side applications
- **TypeScript** - Type-safe development
- **Prisma** - Modern ORM for database management
- **BullMQ** - Redis-based job queue for background processing
- **JWT** - JSON Web Tokens for authentication
- **Passport** - Authentication middleware with OAuth2 strategies

### Infrastructure & DevOps
- **Terraform** - Infrastructure as Code (IaC) for managing AWS resources
- **AWS Lambda** - Serverless compute for API endpoints
- **API Gateway** - RESTful API management and routing
- **AWS Amplify** - Frontend hosting and CI/CD (uses default domain: `*.amplifyapp.com`)
- **Amazon RDS (PostgreSQL)** - Managed relational database
- **Amazon ElastiCache (Redis)** - Managed in-memory cache and message broker
- **Amazon ECS** - Container orchestration for worker services
- **Amazon S3** - Static file storage
- **Docker** - Containerization for local development and worker deployment
- **GitHub Actions** - CI/CD pipeline automation (separated into infrastructure and application pipelines)

### Monitoring & Observability
- **AWS CloudWatch** - Logging, metrics, and monitoring
- **OpenTelemetry** (optional) - Distributed tracing

## 🧩 Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Amplify (Frontend)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React + Vite App (Static Hosting)                       │  │
│  │  Default Domain: *.amplifyapp.com                        │  │
│  │  (No custom domain configured)                            │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │ HTTPS API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (REST API)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Endpoints: /auth, /workflows, /users, etc.              │  │
│  │  SSL/TLS: Automatic via AWS Certificate Manager          │  │
│  └──────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Lambda (Backend API)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NestJS Application (Serverless)                         │  │
│  │  - Authentication                                        │  │
│  │  - Workflow Management                                   │  │
│  │  - User Management                                       │  │
│  │  - API Endpoints                                         │  │
│  └──────────┬──────────────────────┬───────────────────────┘  │
└─────────────┼──────────────────────┼───────────────────────────┘
              │                      │
              ▼                      ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Amazon RDS        │    │  ElastiCache Redis   │
│   (PostgreSQL)      │    │  (Cache & Queue)     │
│                     │    │                      │
│  - User Data        │    │  - Job Queue         │
│  - Workflows        │    │  - Session Cache     │
│  - Executions       │    │  - Rate Limiting     │
│  - OAuth Tokens     │    │                      │
└─────────────────────┘    └──────────┬───────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Amazon ECS (Worker Service)                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NestJS Worker Containers                                │  │
│  │  - Process Background Jobs                               │  │
│  │  - Execute Workflows                                     │  │
│  │  - Handle Async Tasks                                    │  │
│  │  - Process Redis Queue Jobs                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Amazon S3 (Static Files)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  - Workflow assets                                       │  │
│  │  - User uploads                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Low-Level Module Workflows

#### Frontend Module Workflow
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Module Flow                      │
└─────────────────────────────────────────────────────────────┘

User Action (Browser)
    │
    ▼
┌──────────────┐
│  React UI    │ (Pages, Components, Context)
│  - Workflow  │
│    Builder   │
│  - Dashboard │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  API Client  │ (Axios with Auth Headers)
│  - State     │
│    Management│
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────┐
│  API Gateway │ (HTTPS Request)
│  - Routing   │
│  - Auth      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Lambda     │ (NestJS Handler)
│   - Handler  │
└──────────────┘
```

#### Backend API Module Workflow
```
┌─────────────────────────────────────────────────────────────┐
│                   Backend API Module Flow                    │
└─────────────────────────────────────────────────────────────┘

API Gateway Request
    │
    ▼
┌──────────────────┐
│  Lambda Handler  │ (lambda.ts)
│  - aws-serverless│
│    -express      │
│  - Event Parsing │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  NestJS App      │
│  - Controllers   │ (Route Handlers)
│  - Services      │ (Business Logic)
│  - Guards        │ (Authentication)
│  - Interceptors  │ (Request/Response)
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│  Prisma │ │  Redis   │
│  (RDS)  │ │ (Cache)  │
│         │ │ (Queue)  │
│  - Read │ │          │
│  - Write│ │ - Cache  │
│  - Query│ │ - Queue  │
└─────────┘ └──────────┘
```

#### Worker Service Module Workflow
```
┌─────────────────────────────────────────────────────────────┐
│                  Worker Service Module Flow                  │
└─────────────────────────────────────────────────────────────┘

Workflow Trigger Event
    │
    ▼
┌──────────────────┐
│  Job Enqueued    │ (From Lambda Backend)
│  to Redis Queue  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  BullMQ Queue    │ (Redis-based)
│  - gmail-event   │
│  - workflow-exec │
│  - scheduled-job │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ECS Worker      │ (NestJS Worker Container)
│  - Process Job   │
│  - Execute Action│
│  - Handle Errors │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│  RDS    │ │ External │
│  (Save) │ │  APIs    │
│         │ │          │
│  - Log  │ │ - Gmail  │
│  - State│ │ - Slack  │
│  - Result│ │ - Google│
└─────────┘ └──────────┘
```

#### CI/CD Pipeline Workflow

**Infrastructure Pipeline:**
```
┌─────────────────────────────────────────────────────────────┐
│           Infrastructure Deployment Pipeline                  │
└─────────────────────────────────────────────────────────────┘

GitHub Actions Trigger (workflow_dispatch)
    │
    ▼
┌──────────────────┐
│  Terraform Init  │
│  (S3 Backend)    │
│  - State Storage │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Terraform Plan  │
│  (Validate)      │
│  - Diff Review   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Terraform Apply │
│  (Create/Update) │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  VPC │ │ RDS  │ │Redis │ │ ECS  │ │ S3   │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
    │         │         │         │         │
    └─────────┴─────────┴─────────┴─────────┘
              │
              ▼
        ┌──────────┐
        │  Lambda  │
        │  API GW  │
        │  Amplify │
        └──────────┘
```

**Application Pipeline:**
```
┌─────────────────────────────────────────────────────────────┐
│           Application Deployment Pipeline                    │
└─────────────────────────────────────────────────────────────┘

GitHub Push/PR Trigger
    │
    ▼
┌──────────────────┐
│  Build & Test    │
│  - Install Deps  │
│  - Run Tests     │
│  - Lint Code     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│ Backend │ │ Frontend │
│ Build   │ │ Build    │
└────┬────┘ └─────┬────┘
     │            │
     ▼            ▼
┌─────────┐ ┌──────────┐
│ Lambda  │ │ Amplify │
│ Deploy  │ │ Deploy  │
│         │ │         │
│ - Package│ │ - Build │
│ - Upload │ │ - Host  │
│ - Update │ │ - SSL   │
└─────────┘ └──────────┘
```

## 🚀 Setup Instructions

### Prerequisites

Before setting up FlowGenie, ensure you have the following installed:

- **Node.js** >= 18.x (LTS recommended)
- **npm** >= 9.x or **yarn** >= 1.22.x
- **Terraform** >= 1.0
- **AWS CLI** >= 2.0 (configured with credentials)
- **Docker** >= 20.x and **Docker Compose** >= 2.0
- **Git** >= 2.30.x

### Clone the Repository

```bash
git clone <repository-url>
cd biwoco_flowgenie_0
```

### Install Dependencies

#### Backend Dependencies

```bash
cd backend
npm install
```

#### Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Configure Environment Variables

#### Backend Environment Variables

Copy the template file and configure your environment:

```bash
cd backend
cp env.template .env
```

Edit `.env` with your configuration:

```env
# Application
PORT=3000
APP_URL=https://localhost:3000
FRONTEND_URL=https://localhost:8080
NODE_ENV=development

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/flowgenie_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=604800

# Google OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://localhost:3000/auth/google/callback
```

#### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=https://localhost:3000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

### Run Locally with SSL

FlowGenie enforces SSL for all endpoints, including local development. Use Docker Compose for local development with SSL:

```bash
# From project root
docker-compose up -d
```

This will start:
- **Backend** on `https://localhost:3000`
- **Frontend** on `https://localhost:8080`
- **PostgreSQL** on `localhost:5432`
- **Redis** on `localhost:6379`
- **Worker** service (background jobs)

SSL certificates are configured in the `certs/` directory for local development.

Alternatively, run services individually:

#### Start Database and Redis

```bash
docker-compose up -d db redis
```

#### Run Backend Locally

```bash
cd backend
npm run start:dev
```

#### Run Frontend Locally

```bash
cd frontend
npm run dev
```

### Database Migrations

Run Prisma migrations to set up the database schema:

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
```

## ☁️ Infrastructure Deployment

### Terraform Setup

FlowGenie uses Terraform to manage all AWS infrastructure resources, including:
- VPC with public and private subnets
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- Lambda function and API Gateway
- ECS cluster and service for workers
- Amplify app for frontend hosting
- S3 buckets for static files

#### 1. Initialize Terraform

```bash
cd terraform
terraform init \
  -backend-config="bucket=flowgenie-terraform-state" \
  -backend-config="key=dev/terraform.tfstate" \
  -backend-config="region=us-east-1"
```

#### 2. Configure Terraform Variables

Create a `terraform.tfvars` file based on the example:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your configuration:

```hcl
stage = "dev"
aws_region = "us-east-1"
project_name = "flowgenie"

# Database Configuration
db_name = "flowgenie_db"
db_username = "flowgenie_admin"
db_password = "your-secure-password"  # Or use GitHub secrets

# Amplify Configuration
amplify_repository_url = "https://github.com/your-org/flowgenie"
devops_token = "your-github-token"  # Or use GitHub secrets

# Additional Configuration
# See terraform/VARIABLES.md for all available variables
```

#### 3. Plan Infrastructure Changes

```bash
terraform plan
```

Review the planned changes carefully before applying.

#### 4. Apply Infrastructure

```bash
terraform apply
```

This will create all AWS resources:
- VPC with public and private subnets
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- Lambda function and API Gateway
- ECS cluster and service for workers
- Amplify app for frontend hosting (default domain)
- S3 buckets for static files

#### 5. Destroy Infrastructure

⚠️ **Warning**: This will delete all resources. Use with caution.

```bash
terraform destroy
```

### Terraform Outputs

After deployment, retrieve important outputs:

```bash
terraform output
```

Key outputs:
- `api_gateway_url` - API endpoint URL (HTTPS)
- `rds_endpoint` - Database connection endpoint
- `redis_endpoint` - Redis connection endpoint
- `amplify_app_id` - Amplify app identifier
- `amplify_app_url` - Amplify app URL (default domain: `*.amplifyapp.com`)
- `s3_bucket_name` - S3 bucket for static files

## 🧠 Application Build & Deployment

### CI/CD Pipeline Overview

FlowGenie uses GitHub Actions for automated CI/CD with **two separate pipelines**:

1. **Infrastructure Pipeline** - Deploys Terraform-managed AWS resources (Lambda, RDS, Amplify, Redis, ECS, S3)
2. **Application Pipeline** - Builds and deploys the frontend (Amplify) and backend (Lambda) code

This separation allows for:
- Independent infrastructure updates
- Faster application deployments
- Better control over resource lifecycle
- Environment-specific configurations

### Infrastructure Pipeline (GitHub Actions)

The infrastructure pipeline (`infra-deploy.yml`) is triggered manually via `workflow_dispatch`:

1. Navigate to **Actions** → **Infrastructure Deployment**
2. Click **Run workflow**
3. Select the stage: `dev`, `staging`, or `prod`
4. Review the deployment plan
5. Confirm the deployment

**What it does:**
- Initializes Terraform with S3 backend
- Plans infrastructure changes
- Applies Terraform configuration
- Exports infrastructure outputs
- Updates GitHub environment secrets with output values

**Triggered by:**
- Manual workflow dispatch (recommended)
- Push to `terraform/` directory (optional)

### Application Pipeline (GitHub Actions)

The application pipeline (`app-deploy.yml`) is triggered on:
- Push to `main` branch (when `backend/` or `frontend/` changes)
- Manual workflow dispatch
- Pull request (build and test only)

**What it does:**

#### Backend Deployment:
1. Builds NestJS application
2. Runs database migrations (if applicable)
3. Creates Lambda deployment package
4. Updates Lambda function code
5. Builds and pushes Docker image to ECR
6. Deploys worker service to ECS

#### Frontend Deployment:
1. Builds React application with Vite
2. Deploys to AWS Amplify
3. Uses default Amplify domain (`*.amplifyapp.com`)
4. Configures SSL automatically

### Frontend Deployment via Amplify

The frontend is automatically deployed via AWS Amplify using the default domain:

- **Default Domain**: `https://<app-id>.amplifyapp.com`
- **SSL**: Automatically configured by AWS (no custom certificate needed)
- **Build**: Triggered by GitHub Actions or manual build in Amplify console

**Amplify Build Settings** (configured in Amplify console or via Terraform):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd frontend
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - frontend/node_modules/**/*
```

### Backend Deployment via Lambda + API Gateway

The backend is deployed as a Lambda function exposed through API Gateway:

- **Lambda Function**: NestJS application packaged as a Lambda handler
- **API Gateway**: RESTful API with HTTPS endpoints
- **SSL/TLS**: Automatically provided by AWS Certificate Manager
- **Deployment**: Automated via GitHub Actions

### Environment-Specific Deployments

FlowGenie supports multiple deployment stages:

- **dev** - Development environment
- **staging** - Staging environment for testing
- **prod** - Production environment

Each stage has:
- Separate AWS resources (prefixed with stage name)
- Isolated GitHub environments
- Environment-specific secrets and variables
- Independent Terraform state files

### Deploy via GitHub Actions

#### Infrastructure Deployment:

1. Go to **Actions** tab in GitHub
2. Select **Infrastructure Deployment** workflow
3. Click **Run workflow**
4. Choose the stage (`dev`, `staging`, or `prod`)
5. Review the plan output
6. Approve the deployment

#### Application Deployment:

1. Push changes to `main` branch (or trigger manually)
2. GitHub Actions will automatically:
   - Build frontend and backend
   - Run tests
   - Deploy to appropriate environment
   - Update Lambda function
   - Trigger Amplify build

## 🔒 Security & Secrets

### GitHub Secrets Configuration

Configure the following secrets in **Settings** → **Secrets and variables** → **Actions**:

#### Repository-Level Secrets (Required)

```
AWS_ACCESS_KEY_ID          # AWS IAM user access key
AWS_SECRET_ACCESS_KEY      # AWS IAM user secret key
DEVOPS_TOKEN               # GitHub personal access token (for Amplify)
```

#### Environment-Specific Secrets

Set these in GitHub environment secrets (`dev`, `staging`, `prod`):

**Infrastructure Secrets:**
```
DB_PASSWORD                # Database password (per environment)
```

**Backend Application Secrets:**
```
JWT_SECRET                 # JWT signing secret
GOOGLE_CLIENT_SECRET       # Google OAuth2 client secret
DATABASE_URL               # Full database connection string (optional)
REDIS_URL                  # Redis connection URL (optional)
```

**Frontend Environment Variables:**
```
VITE_API_BASE_URL          # API Gateway URL
VITE_GOOGLE_CLIENT_ID      # Google OAuth2 client ID
```

### Managing Secrets via GitHub

1. **Repository Secrets**: Go to **Settings** → **Secrets and variables** → **Actions**
2. **Environment Secrets**: Go to **Settings** → **Environments** → Select environment → **Secrets**
3. **Environment Variables**: Go to **Settings** → **Environments** → Select environment → **Variables**

### Terraform Variable Management

Terraform variables can be managed via:
- `terraform.tfvars` files (for local development)
- GitHub secrets (for CI/CD)
- Environment variables (prefixed with `TF_VAR_`)

**Example:**
```bash
export TF_VAR_db_password="your-password"
terraform apply
```

### Local Development Secrets

For local development, use `.env` files (never commit these):

- `backend/.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables

**Important**: Add `.env` files to `.gitignore` to prevent accidental commits.

### SSL/TLS Configuration

- **Production**: All endpoints use HTTPS via AWS services
  - **API Gateway**: Automatic SSL via AWS Certificate Manager
  - **Amplify**: Default SSL certificate provided by AWS (for `*.amplifyapp.com`)
- **Local Development**: SSL certificates are configured in `certs/` directory
  - Self-signed certificates for `localhost`
  - Configured in `docker-compose.yml`

## 🧰 Monitoring & Logging

### AWS CloudWatch

FlowGenie integrates with AWS CloudWatch for comprehensive monitoring and logging:

- **Lambda Logs**: Automatic log collection from Lambda functions
- **ECS Logs**: Container logs from ECS worker service
- **API Gateway Logs**: Request/response logging
- **Metrics**: Custom metrics for workflow execution, errors, API response times, etc.

#### Accessing Logs via AWS CLI

```bash
# Lambda logs
aws logs tail /aws/lambda/dev-flowgenie-api --follow

# ECS logs
aws logs tail /ecs/dev-flowgenie-worker --follow

# API Gateway logs
aws logs tail /aws/apigateway/dev-flowgenie-api --follow
```

#### Accessing Logs via AWS Console

1. Navigate to **CloudWatch** → **Logs** → **Log groups**
2. Filter by service:
   - `/aws/lambda/<stage>-flowgenie-api` - Lambda function logs
   - `/ecs/<stage>-flowgenie-worker` - ECS worker logs
   - `/aws/apigateway/<stage>-flowgenie-api` - API Gateway logs

### CloudWatch Metrics

Monitor key metrics:
- **Workflow execution success rate**
- **API response times** (p50, p95, p99)
- **Database connection pool usage**
- **Redis queue length**
- **Lambda function duration and errors**
- **API Gateway request count and latency**

### OpenTelemetry (Optional)

For distributed tracing, configure OpenTelemetry:

1. Install OpenTelemetry SDK in backend:
   ```bash
   npm install @opentelemetry/api @opentelemetry/sdk-node
   ```

2. Configure OTLP exporter:
   ```typescript
   // backend/src/config/telemetry.ts
   import { NodeSDK } from '@opentelemetry/sdk-node';
   
   const sdk = new NodeSDK({
     serviceName: 'flowgenie-api',
     // ... configuration
   });
   ```

3. Set up collector or use AWS X-Ray integration:
   - AWS X-Ray for AWS-native tracing
   - OpenTelemetry Collector for custom tracing

### Application Monitoring

Set up CloudWatch alarms for:
- High error rates
- Slow API response times
- Database connection issues
- Queue backlog
- Worker service health

**Example CloudWatch Alarm:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name flowgenie-high-error-rate \
  --alarm-description "Alert when error rate exceeds threshold" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

## 🧑‍💻 Contributing

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b bugfix/your-bugfix-name
   # or
   git checkout -b hotfix/your-hotfix-name
   ```

2. **Follow naming conventions**:
   - Branch names: `feature/`, `bugfix/`, `hotfix/`
   - Commit messages: Use conventional commits
     - `feat: add workflow execution`
     - `fix: resolve authentication issue`
     - `docs: update README`
     - `test: add unit tests for workflow service`

3. **Make your changes**:
   - Write tests for new features (TDD approach)
   - Follow existing code style
   - Update documentation as needed
   - Add Swagger documentation for API endpoints

4. **Run tests and linting**:
   ```bash
   # Backend
   cd backend
   npm run lint
   npm run test
   npm run test:cov  # Check coverage
   
   # Frontend
   cd frontend
   npm run lint
   npm run test
   ```

5. **Create a Pull Request**:
   - PR title should be descriptive and follow conventional commits
   - Include a detailed description of changes
   - Link any related issues
   - Ensure CI/CD checks pass
   - Request review from team members

6. **Code Review**:
   - Address reviewer feedback promptly
   - Ensure all tests pass
   - Update documentation if needed
   - Keep PR size manageable (prefer smaller, focused PRs)

7. **Merge**:
   - Squash and merge (preferred)
   - Delete feature branch after merge
   - Ensure deployment succeeds

### Code Style

- **Backend**: Follow NestJS style guide, use ESLint and Prettier
- **Frontend**: Follow React best practices, use ESLint and Prettier
- **TypeScript**: Enable strict mode, use proper types
- **Commits**: Use conventional commits format

### Testing Requirements

- **Unit tests**: Required for all services and utilities
- **Integration tests**: Required for API endpoints
- **E2E tests**: Optional, for critical user flows (login, workflow execution)
- **Coverage**: Aim for >80% code coverage

### Before Merging

- ✅ All tests pass
- ✅ Linting passes (`npm run lint`)
- ✅ Code is formatted (`npm run format`)
- ✅ No console errors or warnings
- ✅ Documentation updated (README, API docs, etc.)
- ✅ Swagger documentation added for new endpoints
- ✅ Environment variables documented

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📚 Additional Documentation

- [Backend CI/CD Setup](./docs/BACKEND_CI_CD_SETUP.md)
- [Amplify CI/CD Setup](./docs/AMPLIFY_CI_CD_SETUP.md)
- [Workflow System Documentation](./backend/WORKFLOW_SYSTEM.md)
- [Terraform Variables](./terraform/VARIABLES.md)
- [Terraform Usage Guide](./terraform/USAGE.md)
- [Terraform Quick Start](./terraform/QUICK_START.md)
- [Authentication Setup](./AUTHENTICATION_SETUP.md)
- [Workflow Requirements](./docs/workflow_requirements.md)
- [Development Principles](./docs/dev_principles.md)

## 🆘 Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Contact the development team
- Check the documentation in the `docs/` directory

---

**Built with ❤️ by the FlowGenie Team**
