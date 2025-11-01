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
    return this.prisma.oAuthAccount.upsert(data);
  }
}

