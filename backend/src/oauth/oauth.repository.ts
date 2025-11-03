import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OAuthAccount, Prisma } from '@prisma/client';

@Injectable()
export class OAuthRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.OAuthAccountCreateInput): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.create({ data });
  }

  async findByProviderAndUserId(
    provider: string,
    providerUserId: string,
  ): Promise<OAuthAccount | null> {
    return this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: { user: true },
    });
  }

  async findByUserId(userId: number): Promise<OAuthAccount[]> {
    return this.prisma.oAuthAccount.findMany({ where: { userId } });
  }

  async update(
    id: number,
    data: Prisma.OAuthAccountUpdateInput,
  ): Promise<OAuthAccount> {
    return this.prisma.oAuthAccount.update({ where: { id }, data });
  }

  async upsert(data: {
    where: Prisma.OAuthAccountWhereUniqueInput;
    create: Prisma.OAuthAccountCreateInput;
    update: Prisma.OAuthAccountUpdateInput;
  }): Promise<OAuthAccount> {
    console.log(`🔄 [OAuthRepository] upsert - Storing OAuth account`);
    console.log(`🔄 [OAuthRepository] upsert - Provider: ${(data.where as any).provider_providerUserId?.provider}, ProviderUserId: ${(data.where as any).provider_providerUserId?.providerUserId}`);
    console.log(`🔄 [OAuthRepository] upsert - Create data - hasAccessToken: ${!!(data.create as any).accessToken}, hasRefreshToken: ${!!(data.create as any).refreshToken}`);
    console.log(`🔄 [OAuthRepository] upsert - Update data - hasAccessToken: ${!!(data.update as any).accessToken}, hasRefreshToken: ${!!(data.update as any).refreshToken}`);
    const result = await this.prisma.oAuthAccount.upsert(data);
    console.log(`✅ [OAuthRepository] upsert - OAuth account saved with ID: ${result.id}, hasAccessToken: ${!!result.accessToken}, hasRefreshToken: ${!!result.refreshToken}`);
    return result;
  }
}

