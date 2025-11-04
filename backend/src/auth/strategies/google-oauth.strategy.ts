import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthStrategy extends PassportStrategy(Strategy, 'google') {
  private isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET', '');
    const callbackURL = configService.get<string>('GOOGLE_REDIRECT_URI', '');

    // Check if all credentials are provided
    const hasAllCredentials =
      clientID &&
      clientID.trim() !== '' &&
      clientSecret &&
      clientSecret.trim() !== '' &&
      callbackURL &&
      callbackURL.trim() !== '';

    // super() must be called first and be at root level
    // Use actual credentials if available, otherwise use dummy values
    super({
      clientID: hasAllCredentials ? clientID : 'disabled',
      clientSecret: hasAllCredentials ? clientSecret : 'disabled',
      callbackURL: hasAllCredentials ? callbackURL : 'http://localhost',
      scope: ['email', 'profile'],
    });

    // Set enabled flag after super() call
    this.isEnabled = hasAllCredentials;

    if (!hasAllCredentials) {
      // Log warning but don't throw - allows app to start without OAuth
      console.warn(
        '⚠️  Google OAuth credentials not provided. Google OAuth login will be disabled.',
        'Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables to enable Google OAuth.',
      );
    }
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // If OAuth is disabled, reject authentication
    if (!this.isEnabled) {
      return done(
        new Error(
          'Google OAuth is not configured. Please set required environment variables.',
        ),
        null,
      );
    }

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
