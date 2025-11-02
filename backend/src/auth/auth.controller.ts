import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * @openapi
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     description: Redirects user to Google OAuth consent screen for authentication.
 *     tags:
 *       - Authentication
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Example: Traditional email/password login route documentation
   * (Currently not implemented - app uses Google OAuth)
   * 
   * @openapi
   * /auth/google:
   *   post:
   *     summary: User login
   *     description: Authenticate a user and return a JWT token.
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: P@ssword123
   *     responses:
   *       200:
   *         description: Successful login
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */

  @Get('google')
  async googleAuth(@Res() res: Response): Promise<void> {
    const authUrl = this.authService.getGoogleAuthUrl();
    return res.redirect(authUrl);
  }

  /**
   * @openapi
   * /auth/google/callback:
   *   get:
   *     summary: Google OAuth callback handler
   *     description: Handles the OAuth callback from Google and returns authentication tokens.
   *     tags:
   *       - Authentication
   *     parameters:
   *       - in: query
   *         name: code
   *         required: false
   *         schema:
   *           type: string
   *         description: Authorization code from Google
   *       - in: query
   *         name: error
   *         required: false
   *         schema:
   *           type: string
   *         description: OAuth error message if any
   *     responses:
   *       200:
   *         description: Authentication successful, returns HTML with tokens
   *         content:
   *           text/html:
   *             schema:
   *               type: string
   *       400:
   *         description: Invalid request or OAuth error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *       500:
   *         description: Authentication failed
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> { // This is correct, as the function will now implicitly return void
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const CALLBACK_ROUTE = '/oauth-redirect'; // A new, simple frontend route to process tokens

    // --- Error Handling Function (remains mostly the same) ---
    const redirectWithError = (redirectRes: any, errorMessage: string) => {
      const redirectUrl = `${FRONTEND_URL}/login?oauthError=${encodeURIComponent(errorMessage)}`;
      return redirectRes.redirect(redirectUrl);
    };
    // ---------------------------------------------------------

    if (error) {
      return redirectWithError(res, `OAuth error: ${error}`);
    }

    if (!code) {
      return redirectWithError(res, 'Authorization code is missing');
    }

    try {
      // 1. Exchange code for user data/app tokens
      const result = await this.authService.googleLogin(code);
      const { access_token, refresh_token } = result; // Destructure tokens from the service result

      // 2. SUCCESS: Redirect to the frontend with tokens in URL parameters
      const successRedirectUrl = 
        `${FRONTEND_URL}${CALLBACK_ROUTE}?access_token=${access_token}&refresh_token=${refresh_token}`;
      
      // ✅ Use res.redirect() directly
      return res.redirect(successRedirectUrl); 

    } catch (err: any) {
      // 3. SERVICE ERROR: Redirect with error
      return redirectWithError(res, err.message || 'Authentication failed on server');
    }
  }

  /**
   * @openapi
   * /auth/refresh:
   *   post:
   *     summary: Refresh access token
   *     description: Exchange a refresh token for a new access token.
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refresh_token
   *             properties:
   *               refresh_token:
   *                 type: string
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Token refreshed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid or expired refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refresh_token);
  }

  /**
   * @openapi
   * /auth/logout:
   *   post:
   *     summary: User logout
   *     description: Logout user and revoke refresh token.
   *     tags:
   *       - Authentication
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refresh_token
   *             properties:
   *               refresh_token:
   *                 type: string
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Logged out successfully
   *       401:
   *         description: Unauthorized
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @CurrentUser() user: { id: number },
  ) {
    await this.authService.logout(refreshTokenDto.refresh_token);
    return { message: 'Logged out successfully' };
  }

  /**
   * @openapi
   * /auth/me:
   *   get:
   *     summary: Get current authenticated user
   *     description: Returns the current user's information based on the JWT token.
   *     tags:
   *       - Authentication
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Current user information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: { id: number }) {
    return this.authService.getUserById(user.id);
  }

  /**
   * @openapi
   * /auth/signup:
   *   post:
   *     summary: User signup
   *     description: Register a new user using email and password.
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *                 example: John Doe
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: P@ssword123
   *     responses:
   *       201:
   *         description: User created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Email already exists
   *       500:
   *         description: Server error
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: { name: string; email: string; password: string },
  ): Promise<AuthResponseDto> {
    console.log(body);
    return this.authService.signup(body);
  }

  /**
   * @openapi
   * /auth/google/exchange:
   *   post:
   *     summary: Exchange Google ID token for application tokens
   *     description: Exchange a Google ID token (from @react-oauth/google) for application tokens.
   *     tags:
   *       - Authentication
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *                 description: Google ID token from @react-oauth/google
   *                 example: eyJhbGciOiJSUzI1NiIs...
   *     responses:
   *       200:
   *         description: Authentication successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid ID token
   *       500:
   *         description: Server error
   */
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  async googleExchange(
    @Body() body: { token: string },
  ): Promise<AuthResponseDto> {
    // Decode the Google ID token and extract user info
    const googleOAuthService = (this.authService as any).googleOAuthService;
    const usersService = (this.authService as any).usersService;
    const jwtService = (this.authService as any).jwtService;
    const refreshTokenService = (this.authService as any).refreshTokenService;

    const userInfo = await googleOAuthService.decodeIdToken(body.token);
    if (!userInfo || !userInfo.email || !userInfo.verified_email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    // Create or update user
    const user = await usersService.createOrUpdate({
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    });

    // Generate tokens
    const accessToken = await jwtService.generateAccessToken({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = await refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: jwtService.getAccessTokenExpiration(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
      },
    };
  }

  /**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate a user using email and password.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: P@ssword123
 *     responses:
 *       200:
 *         description: User authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { email: string; password: string },
  ): Promise<AuthResponseDto> {
    var result = this.authService.login(body);
    return result;
  }
}
