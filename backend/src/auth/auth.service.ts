import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from './services/jwt.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { UsersService } from '../users/users.service';
import { OAuthService } from '../oauth/oauth.service';
import { AuthResponseDto, UserDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';

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

    // Mark user as Google linked
    await this.usersService.updateUser(user.id, { googleLinked: true });

    // Generate JWT and refresh token
    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name || undefined,
        avatar: user.avatar || undefined,
        googleLinked: true,
      },
    };
  }

  async googleLoginWithIdToken(idToken: string): Promise<AuthResponseDto> {
    // Decode the Google ID token and extract user info
    const userInfo = await this.googleOAuthService.decodeIdToken(idToken);
    if (!userInfo || !userInfo.email || !userInfo.verified_email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    // Create or update user
    const user = await this.usersService.createOrUpdate({
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    });

    // Store OAuth account info from ID token
    // Note: ID tokens don't provide access/refresh tokens for API calls
    // To get access tokens for Gmail/Calendar APIs, user needs to complete 
    // the authorization code flow via /auth/google/connect
    // However, we still store the OAuth account record and mark user as Google-linked
    // since they authenticated with Google
    await this.oAuthService.upsertOAuthAccount({
      userId: user.id,
      provider: 'google',
      providerUserId: userInfo.id,
      // No access/refresh tokens from ID token - these will be null
      // User needs to complete /auth/google/connect to get access tokens
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
    });

    // Mark user as Google linked (they authenticated with Google)
    // Even though we don't have access tokens yet, they've authenticated via Google
    await this.usersService.updateUser(user.id, { googleLinked: true });

    // Fetch the updated user to ensure we have the latest googleLinked status
    const updatedUser = await this.usersService.findById(user.id);
    if (!updatedUser) {
      throw new UnauthorizedException('User not found');
    }

    // Generate JWT and refresh token
    const accessToken = await this.jwtService.generateAccessToken({
      sub: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken(updatedUser.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        name: updatedUser.name || undefined,
        avatar: updatedUser.avatar || undefined,
        googleLinked: updatedUser.googleLinked || false,
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
      username: user.username,
      email: user.email,
    });

    return {
      access_token: accessToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
    };
  }

  getGoogleConnectUrl(userId: number): string {
    // Include userId in state for callback verification
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    return this.googleOAuthService.getAuthorizationUrl(state);
  }

  async connectGoogleAccount(userId: number, code: string): Promise<{ success: boolean; message: string }> {
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

    // Verify user exists
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

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

    // Mark user as Google linked
    await this.usersService.updateUser(userId, { googleLinked: true });

    return {
      success: true,
      message: 'Google account connected successfully',
    };
  }

  async disconnectGoogleAccount(userId: number): Promise<{ success: boolean; message: string }> {
    const oauthAccount = await this.oAuthService.findByUserIdAndProvider(userId, 'google');
    if (!oauthAccount) {
      throw new BadRequestException('Google account not connected');
    }

    // Note: We don't delete the OAuth account, we just mark the user as not linked
    // This allows reconnection later. If you want to delete it, use:
    // await this.oAuthService.deleteOAuthAccount(oauthAccount.id);
    
    await this.usersService.updateUser(userId, { googleLinked: false });

    return {
      success: true,
      message: 'Google account disconnected successfully',
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
      username: user.username || undefined,
      email: user.email || undefined,
      name: user.name || undefined,
      avatar: user.avatar || undefined,
      googleLinked: user.googleLinked || false,
    };
  }

  async login(body: { username: string; password: string }): Promise<AuthResponseDto> {
    const { username, password } = body;

    // Find user by username
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate access & refresh token
    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        googleLinked: user.googleLinked,
      },
    };
  }

  async signup(body: { name: string; username: string; email?: string; password: string }): Promise<AuthResponseDto> {
    const { name, username, email, password } = body;

    // Check if username already exists
    const existing = await this.usersService.findByUsername(username);
    if (existing) {
      throw new BadRequestException('Username already registered');
    }

    // If email provided, check if it exists
    if (email) {
      const existingEmail = await this.usersService.findByEmail(email);
      if (existingEmail) {
        throw new BadRequestException('Email already registered');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = await this.usersService.createUser({
      name,
      username,
      email,
      password: hashedPassword,
    });

    // Generate access & refresh token
    const accessToken = await this.jwtService.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
    });

    const refreshToken = await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.jwtService.getAccessTokenExpiration(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        googleLinked: user.googleLinked,
      },
    };
  }

  /**
   * Tìm user theo email
   */
  async findByEmail(email: string): Promise<UserDto | null> {
    return this.usersService.findByEmail(email);
  }

  /**
   * Tạo user mới
   */
  async create(data: { name: string; email: string; password?: string }): Promise<UserDto> {
    let hashedPassword: string | undefined = undefined;

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(data.password, salt);
    }

    return this.usersService.createUser({
      name: data.name,
      email: data.email,
      password: hashedPassword,
    });
  }

  /**
   * Tạo mới hoặc cập nhật user nếu đã tồn tại
   */
  async createOrUpdate(data: { email: string; name?: string; avatar?: string, password?: string }): Promise<UserDto | null> {
    return this.usersService.createOrUpdate({
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        password: data.password
    });
  }

  /**
   * Tìm user theo ID
   */
  async findById(id: number): Promise<UserDto | null> {
    return this.usersService.findById(id);
  }

  /**
   * Cập nhật thông tin user
   */
  async updateUser(id: number, data: { name?: string; avatar?: string }): Promise<UserDto> | null {
    return this.usersService.updateUser(id, data);
  }
}
