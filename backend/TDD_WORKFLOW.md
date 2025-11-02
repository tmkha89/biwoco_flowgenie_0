# Test-Driven Development (TDD) Workflow

## Principles

**Always write tests BEFORE implementation code.**

## Workflow

1. **Describe Feature** → User describes a feature (e.g., login, signup, OAuth2 flow)
2. **Generate Tests First** → Write comprehensive unit tests covering:
   - Service layer
   - Controller layer  
   - Repository layer (if applicable)
3. **Test Structure**:
   - Clear `describe` blocks for each method
   - Mock all dependencies (Prisma, JwtService, RefreshTokenService, etc.)
   - Success scenarios
   - Failure scenarios
   - Proper `expect` statements for response shape and exceptions
4. **Write Implementation** → Only after tests are written, implement minimal code to make tests pass
5. **Verify** → Run tests to ensure they pass

## Test File Structure

- Tests live in `*.spec.ts` files beside source files
- Example: `auth.service.spec.ts` beside `auth.service.ts`
- Location: `/src` folder (configured in `package.json` Jest config)

## Testing Framework

- **Framework**: Jest
- **NestJS Testing**: `@nestjs/testing`
- **Mocking**: Jest mocks (`jest.fn()`, `mockResolvedValue`, `mockReturnValue`, etc.)
- **Assertions**: Jest `expect()` statements

## Example Pattern

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  // ... other mocks

  beforeEach(async () => {
    // Setup mocks
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        // ... other providers
      ],
    }).compile();
    
    service = module.get<AuthService>(AuthService);
    // ... get mocked services
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Test failure scenario
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Test failure scenario
    });
  });
});
```

## Test Coverage Requirements

Each feature should have tests for:
- ✅ Success cases
- ✅ Failure cases (invalid input, missing data, exceptions)
- ✅ Edge cases
- ✅ Dependency interactions (verify mocked methods called correctly)

## Implementation Guidelines

- Write only the minimal code needed to make tests pass
- Follow existing code patterns and conventions
- Maintain clean, readable TypeScript
- Ensure all tests pass before considering feature complete

