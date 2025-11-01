import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UsersService } from '../users/users.service';
import { OAuthService } from '../oauth/oauth.service';
import { AuthResponseDto, UserDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private refreshTokenService: RefreshTokenService,
    private googleOAuthService: GoogleOAuthService,
    private usersService: UsersService,
    private oAuthService: OAuthService,
  ) {}

  getGoogleAuthUrl(): string {
    return this.googleOAuthService.getAuthorizationUrl();
  }

  async googleLogin(code: string): Promise<AuthResponseDto> {
    // Exchange code for tokens
    const tokens = await this.googleOAuthService.exchangeCodeForTokens(code);

    // Get user info from ID token or access token
    let userInfo = await this.googleOAuthService.decodeIdToken(tokens.id_token);
    if (!userInfo) {
      userInfo = await this.googleOAuthService.getUserInfo(tokens.access_token);
    }

    if (!userInfo || !userInfo.email || !userInfo.verified_email) {
      throw new UnauthorizedException('Invalid Google account');
    }

    // Create or update user
    const user = await this.usersService.createOrUpdate({
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    });

    // Create or update OAuth account
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await this.oAuthService.upsertOAuthAccount({
      userId: user.id,
      provider: 'google',
      providerUserId: userInfo.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    // Generate JWT and refresh token
    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
    const validation = await this.refreshTokenService.validateRefreshToken(refreshToken);
    if (!validation) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(validation.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      email: user.email,
    });

    return {
      access_token: accessToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeRefreshToken(refreshToken);
  }

  async getUserById(userId: number): Promise<UserDto | null> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      avatar: user.avatar || undefined,
    };
  }
}
