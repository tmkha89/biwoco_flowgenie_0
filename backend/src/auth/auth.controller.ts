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
    console.log('🔐 [AuthController] Google Auth - Google login initiated');
    try {
      const authUrl = this.authService.getGoogleAuthUrl();
      console.log('🔐 [AuthController] Google Auth - Generated OAuth URL');
      console.log('🔐 [AuthController] Google Auth - Full OAuth URL:', authUrl);
      console.log('🔐 [AuthController] Google Auth - URL starts with https://accounts.google.com:', authUrl.startsWith('https://accounts.google.com'));
      console.log('🔐 [AuthController] Google Auth - URL length:', authUrl.length);
      console.log('🔐 [AuthController] Google Auth - Redirecting to Google OAuth');
      return res.redirect(authUrl);
    } catch (error: any) {
      console.error('❌ [AuthController] Google Auth - Error generating OAuth URL:', error.message);
      throw error;
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
    @Body() body: { name: string; username: string; email?: string; password: string },
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
    return this.authService.googleLoginWithIdToken(body.token);
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
    @Body() body: { username: string; password: string },
  ): Promise<AuthResponseDto> {
    var result = this.authService.login(body);
    return result;
  }

  /**
   * @openapi
   * /auth/google/connect:
   *   post:
   *     summary: Get Google OAuth connection URL
   *     description: Returns the Google OAuth authorization URL for authenticated user to connect their Google account.
   *     tags:
   *       - Authentication
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: OAuth URL returned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 url:
   *                   type: string
   *                   description: Google OAuth authorization URL
   *       401:
   *         description: Unauthorized
   */
  @Post('google/connect')
  @UseGuards(JwtAuthGuard)
  async googleConnect(@CurrentUser() user: { id: number }): Promise<{ url: string }> {
    console.log(`🔗 [AuthController] Google Connect - User ${user.id} requesting OAuth URL`);
    const authUrl = this.authService.getGoogleConnectUrl(user.id);
    console.log(`🔗 [AuthController] Google Connect - Generated OAuth URL for user ${user.id}`);
    console.log(`🔗 [AuthController] Google Connect - OAuth URL: ${authUrl.substring(0, 100)}...`);
    return { url: authUrl };
  }

  /**
   * @openapi
   * /auth/google/callback:
   *   get:
   *     summary: Google OAuth callback handler for account connection
   *     description: Handles the OAuth callback from Google and connects the Google account to the authenticated user.
   *     tags:
   *       - Authentication
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: code
   *         required: false
   *         schema:
   *           type: string
   *         description: Authorization code from Google
   *       - in: query
   *         name: state
   *         required: false
   *         schema:
   *           type: string
   *         description: State parameter containing user ID
   *       - in: query
   *         name: error
   *         required: false
   *         schema:
   *           type: string
   *         description: OAuth error message if any
   *     responses:
   *       200:
   *         description: Google account connected successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: Invalid request or OAuth error
   *       401:
   *         description: Unauthorized
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    console.log('📥 [AuthController] Google Callback - OAuth callback received');
    console.log(`📥 [AuthController] Google Callback - Query params: code=${code ? 'present' : 'missing'}, state=${state ? 'present' : 'missing'}, error=${error || 'none'}`);
    
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    const SUCCESS_ROUTE = '/dashboard'; // Redirect to dashboard on success
    const LOGIN_ROUTE = '/login'; // Redirect to login on error

    // Error handling
    if (error) {
      console.error(`❌ [AuthController] Google Callback - OAuth error: ${error}`);
      const redirectUrl = `${FRONTEND_URL}${LOGIN_ROUTE}?googleError=${encodeURIComponent(`OAuth error: ${error}`)}`;
      return res.redirect(redirectUrl);
    }

    if (!code) {
      console.error('❌ [AuthController] Google Callback - Authorization code is missing');
      const redirectUrl = `${FRONTEND_URL}${LOGIN_ROUTE}?googleError=${encodeURIComponent('Authorization code is missing')}`;
      return res.redirect(redirectUrl);
    }

    // Handle two scenarios:
    // 1. Initial login without state -> use googleLogin (creates user and gets tokens)
    // 2. Connect existing account with state containing userId -> use connectGoogleAccount
    if (!state) {
      // No state = initial login flow
      try {
        console.log(`🔄 [AuthController] Google Callback - No state, treating as initial login`);
        const result = await this.authService.googleLogin(code);
        console.log(`✅ [AuthController] Google Callback - Initial login successful for user ${result.user.id}`);
        
        // Store tokens in cookies or return them via URL (for now, redirect to callback with tokens)
        const redirectUrl = `${FRONTEND_URL}/oauth-redirect?access_token=${result.access_token}&refresh_token=${result.refresh_token}&googleLinked=${result.user.googleLinked}`;
        console.log(`🔄 [AuthController] Google Callback - Redirecting to oauth-redirect`);
        return res.redirect(redirectUrl);
      } catch (err: any) {
        console.error(`❌ [AuthController] Google Callback - Initial login error:`, err.message || err);
        const redirectUrl = `${FRONTEND_URL}${LOGIN_ROUTE}?googleError=${encodeURIComponent(err.message || 'Login failed')}`;
        return res.redirect(redirectUrl);
      }
    }

    // State exists = connecting existing account
    let userId: number;
    try {
      console.log(`🔍 [AuthController] Google Callback - Parsing state parameter`);
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      console.log(`🔍 [AuthController] Google Callback - State data:`, stateData);
      if (!stateData.userId) {
        throw new Error('Invalid state: userId missing');
      }
      userId = stateData.userId;
      console.log(`✅ [AuthController] Google Callback - Extracted userId: ${userId}`);
    } catch (e: any) {
      console.error(`❌ [AuthController] Google Callback - Failed to parse state: ${e.message}`);
      const redirectUrl = `${FRONTEND_URL}${SUCCESS_ROUTE}?googleError=${encodeURIComponent('Invalid state parameter')}`;
      return res.redirect(redirectUrl);
    }

    try {
      console.log(`🔄 [AuthController] Google Callback - Connecting Google account for user ${userId}`);
      // Connect Google account
      await this.authService.connectGoogleAccount(userId, code);
      console.log(`✅ [AuthController] Google Callback - Successfully connected Google account for user ${userId}`);
      
      // Redirect to frontend with success message
      const redirectUrl = `${FRONTEND_URL}${SUCCESS_ROUTE}?googleConnected=true`;
      console.log(`🔄 [AuthController] Google Callback - Redirecting to: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    } catch (err: any) {
      console.error(`❌ [AuthController] Google Callback - Error connecting Google account:`, err.message || err);
      const redirectUrl = `${FRONTEND_URL}${SUCCESS_ROUTE}?googleError=${encodeURIComponent(err.message || 'Failed to connect Google account')}`;
      return res.redirect(redirectUrl);
    }
  }

  /**
   * @openapi
   * /auth/google/disconnect:
   *   post:
   *     summary: Disconnect Google account
   *     description: Disconnects the Google account from the authenticated user.
   *     tags:
   *       - Authentication
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Google account disconnected successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       400:
   *         description: Google account not connected
   *       401:
   *         description: Unauthorized
   */
  @Post('google/disconnect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async googleDisconnect(@CurrentUser() user: { id: number }) {
    return this.authService.disconnectGoogleAccount(user.id);
  }
}
