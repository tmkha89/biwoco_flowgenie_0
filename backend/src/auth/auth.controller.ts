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
   * /auth/login:
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
  async googleAuth(@Res() res: Response) {
    const authUrl = await this.authService.getGoogleAuthUrl();
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
    if (error) {
      // Fix: Change 'return res.status...' to 'res.status...'
      res.status(400).json({ error: `OAuth error: ${error}` });
      return; // Explicitly return void to end the function execution
    }

    if (!code) {
      // Fix: Change 'return res.status...' to 'res.status...'
      res.status(400).json({ error: 'Authorization code is required' });
      return; // Explicitly return void to end the function execution
    }

    try {
      const result = await this.authService.googleLogin(code);

      // For web redirect, send HTML that redirects to frontend
      const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
      
      // Fix: Change 'return res.send...' to 'res.send...'
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
          </head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'OAUTH_SUCCESS',
                data: ${JSON.stringify(result)}
              }, '${frontendUrl}');
              window.close();
            </script>
            <p>Redirecting...</p>
          </body>
        </html>
      `);
      // No 'return' needed here, as the function implicitly ends.

    } catch (err: any) {
      // Fix: Change 'return res.status...' to 'res.status...'
      res.status(500).json({ error: err.message || 'Authentication failed' });
      return; // Explicitly return void to end the function execution
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
}
