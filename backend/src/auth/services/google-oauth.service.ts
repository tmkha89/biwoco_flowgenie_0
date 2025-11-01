import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
}

@Injectable()
export class GoogleOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(private configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      '',
    );

    // Validate required OAuth credentials
    if (!this.clientId || this.clientId.trim() === '') {
      throw new Error(
        'Google OAuth clientID is required. Please set GOOGLE_CLIENT_ID environment variable.',
      );
    }
    if (!this.clientSecret || this.clientSecret.trim() === '') {
      throw new Error(
        'Google OAuth clientSecret is required. Please set GOOGLE_CLIENT_SECRET environment variable.',
      );
    }
    if (!this.redirectUri || this.redirectUri.trim() === '') {
      throw new Error(
        'Google OAuth redirect URI is required. Please set GOOGLE_REDIRECT_URI environment variable.',
      );
    }
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await axios.post<GoogleTokenResponse>(
      'https://oauth2.googleapis.com/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const response = await axios.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
  }

  async decodeIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    try {
      // Decode JWT without verification (Google's ID tokens are signed)
      // In production, you should verify the token signature
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );

      return {
        id: payload.sub,
        email: payload.email,
        verified_email: payload.email_verified || false,
        name: payload.name || '',
        picture: payload.picture || '',
        given_name: payload.given_name || '',
        family_name: payload.family_name || '',
      };
    } catch (error) {
      return null;
    }
  }
}
