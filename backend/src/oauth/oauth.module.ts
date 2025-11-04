import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthRepository } from './oauth.repository';

@Module({
  providers: [OAuthService, OAuthRepository],
  exports: [OAuthService, OAuthRepository],
})
export class OAuthModule {}
