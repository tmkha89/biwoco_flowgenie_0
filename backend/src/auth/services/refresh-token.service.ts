import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RedisService } from '../../database/redis.service';
import { randomBytes } from 'crypto';

@Injectable()
export class RefreshTokenService {
  private readonly refreshTokenExpiration: number;

  constructor(
    private refreshTokenRepository: RefreshTokenRepository,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    // Default to 7 days in seconds
    this.refreshTokenExpiration =
      parseInt(
        this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '604800'),
      ) || 604800;
  }

  async generateRefreshToken(userId: number): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiration * 1000);

    // Store in database
    await this.refreshTokenRepository.create({
      token,
      expiresAt,
      user: { connect: { id: userId } },
    });

    // Store in Redis for fast lookup
    await this.redisService.set(
      `refresh_token:${token}`,
      userId.toString(),
      this.refreshTokenExpiration,
    );

    return token;
  }

  async validateRefreshToken(
    token: string,
  ): Promise<{ userId: number } | null> {
    // Check Redis first
    const cachedUserId = await this.redisService.get(`refresh_token:${token}`);
    if (cachedUserId) {
      return { userId: parseInt(cachedUserId, 10) };
    }

    // Fallback to database
    const refreshToken = await this.refreshTokenRepository.findByToken(token);
    if (!refreshToken) {
      return null;
    }

    if (refreshToken.revoked || refreshToken.expiresAt < new Date()) {
      return null;
    }

    // Cache in Redis
    const remainingTtl = Math.floor(
      (refreshToken.expiresAt.getTime() - Date.now()) / 1000,
    );
    if (remainingTtl > 0) {
      await this.redisService.set(
        `refresh_token:${token}`,
        refreshToken.userId.toString(),
        remainingTtl,
      );
    }

    return { userId: refreshToken.userId };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.refreshTokenRepository.revoke(token);
    await this.redisService.del(`refresh_token:${token}`);
  }

  async revokeAllForUser(userId: number): Promise<void> {
    // Delete from Redis (we'd need to scan, but for simplicity we'll just delete from DB)
    // In production, you might want to track tokens per user in Redis
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }
}
