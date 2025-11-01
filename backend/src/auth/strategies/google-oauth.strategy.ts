import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET', '');
    const callbackURL = configService.get<string>('GOOGLE_REDIRECT_URI', '');

    // Validate required OAuth credentials
    if (!clientID || clientID.trim() === '') {
      throw new Error(
        'Google OAuth clientID is required. Please set GOOGLE_CLIENT_ID environment variable.',
      );
    }
    if (!clientSecret || clientSecret.trim() === '') {
      throw new Error(
        'Google OAuth clientSecret is required. Please set GOOGLE_CLIENT_SECRET environment variable.',
      );
    }
    if (!callbackURL || callbackURL.trim() === '') {
      throw new Error(
        'Google OAuth redirect URI is required. Please set GOOGLE_REDIRECT_URI environment variable.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      provider: 'google',
      providerUserId: id,
      email: emails[0].value,
      name: name.givenName + ' ' + name.familyName,
      avatar: photos[0].value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}

