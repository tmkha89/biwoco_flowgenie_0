import { Injectable } from '@nestjs/common';
import { OAuthRepository } from './oauth.repository';
import { OAuthAccount } from '@prisma/client';

@Injectable()
export class OAuthService {
  constructor(private oauthRepository: OAuthRepository) {}

  async createOAuthAccount(data: {
    userId: number;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccount> {
    return this.oauthRepository.create({
      user: { connect: { id: data.userId } },
      provider: data.provider,
      providerUserId: data.providerUserId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    });
  }

  async findByProviderAndUserId(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.oauthRepository.findByProviderAndUserId(provider, providerUserId);
  }

  async updateOAuthAccount(
    id: number,
    data: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
    },
  ): Promise<OAuthAccount> {
    return this.oauthRepository.update(id, data);
  }

  async upsertOAuthAccount(data: {
    userId: number;
    provider: string;
    providerUserId: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<OAuthAccount> {
    return this.oauthRepository.upsert({
      where: {
        provider_providerUserId: {
          provider: data.provider,
          providerUserId: data.providerUserId,
        },
      },
      create: {
        user: { connect: { id: data.userId } },
        provider: data.provider,
        providerUserId: data.providerUserId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
      update: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByUserId(userId: number): Promise<OAuthAccount[]> {
    return this.oauthRepository.findByUserId(userId);
  }

  async findByUserIdAndProvider(userId: number, provider: string): Promise<OAuthAccount | null> {
    const accounts = await this.oauthRepository.findByUserId(userId);
    return accounts.find(account => account.provider === provider) || null;
  }

  async refreshGoogleTokens(userId: number, refreshToken: string, googleOAuthService: any): Promise<OAuthAccount> {
    // Exchange refresh token for new access token
    const tokenResponse = await googleOAuthService.refreshAccessToken(refreshToken);
    
    // Find existing OAuth account
    const oauthAccount = await this.findByUserIdAndProvider(userId, 'google');
    if (!oauthAccount) {
      throw new Error('Google OAuth account not found');
    }

    // Update tokens
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    return this.updateOAuthAccount(oauthAccount.id, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || refreshToken, // Keep existing if not provided
      expiresAt,
    });
  }

  async getGoogleAccessToken(userId: number, googleOAuthService: any): Promise<string> {
    // Get Google OAuth account
    const oauthAccount = await this.findByUserIdAndProvider(userId, 'google');
    if (!oauthAccount || !oauthAccount.accessToken) {
      throw new Error('Google account not connected');
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const isExpired = oauthAccount.expiresAt 
      ? oauthAccount.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000
      : false;

    if (isExpired && oauthAccount.refreshToken) {
      // Refresh the token
      const refreshed = await this.refreshGoogleTokens(userId, oauthAccount.refreshToken, googleOAuthService);
      return refreshed.accessToken || '';
    }

    return oauthAccount.accessToken;
  }
}

