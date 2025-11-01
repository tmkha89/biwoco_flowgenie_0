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
}

