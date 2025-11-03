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
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');
    const redirectUri = this.configService.get<string>(
      'GOOGLE_REDIRECT_URI',
      '',
    );

    // Check if all credentials are provided
    const hasAllCredentials =
      clientId && clientId.trim() !== '' &&
      clientSecret && clientSecret.trim() !== '' &&
      redirectUri && redirectUri.trim() !== '';

    if (!hasAllCredentials) {
      // Log warning but don't throw - allows app to start without OAuth
      console.warn(
        '⚠️  Google OAuth Service: Credentials not provided. Google OAuth functionality will be disabled.',
      );
      this.isEnabled = false;
      this.clientId = '';
      this.clientSecret = '';
      this.redirectUri = '';
    } else {
      this.isEnabled = true;
      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.redirectUri = redirectUri;
    }
  }

  getAuthorizationUrl(state?: string): string {
    if (!this.isEnabled) {
      throw new Error(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.',
      );
    }

    console.log(`🔗 [GoogleOAuthService] getAuthorizationUrl - Generating OAuth authorization URL`);
    console.log(`🔗 [GoogleOAuthService] getAuthorizationUrl - Client ID: ${this.clientId}`);
    console.log(`🔗 [GoogleOAuthService] getAuthorizationUrl - Redirect URI: ${this.redirectUri}`);
    console.log(`🔗 [GoogleOAuthService] getAuthorizationUrl - State: ${state ? 'present' : 'none'}`);

    // Required OAuth2 scopes for Gmail and Calendar
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
    ].join(' ');

    console.log(`🔗 [GoogleOAuthService] getAuthorizationUrl - Scopes: ${scopes}`);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log(`✅ [GoogleOAuthService] getAuthorizationUrl - Authorization URL generated`);
    return authUrl;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    console.log(`🔄 [GoogleOAuthService] exchangeCodeForTokens - Exchanging authorization code for tokens`);
    if (!this.isEnabled) {
      console.error('❌ [GoogleOAuthService] exchangeCodeForTokens - Google OAuth is not configured');
      throw new Error(
        'Google OAuth is not configured. Please set required environment variables.',
      );
    }

    console.log(`🔄 [GoogleOAuthService] exchangeCodeForTokens - Code: ${code.substring(0, 20)}...`);
    console.log(`🔄 [GoogleOAuthService] exchangeCodeForTokens - Redirect URI: ${this.redirectUri}`);
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });

    console.log(`📡 [GoogleOAuthService] exchangeCodeForTokens - Calling Google token endpoint`);
    console.log(`📡 [GoogleOAuthService] exchangeCodeForTokens - Client ID: ${this.clientId}`);
    console.log(`📡 [GoogleOAuthService] exchangeCodeForTokens - Redirect URI: ${this.redirectUri}`);
    try {
      const response = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      console.log(`✅ [GoogleOAuthService] exchangeCodeForTokens - Token exchange successful`);
      console.log(`✅ [GoogleOAuthService] exchangeCodeForTokens - Response: access_token=${response.data.access_token ? 'present' : 'missing'}, refresh_token=${response.data.refresh_token ? 'present' : 'missing'}, expires_in=${response.data.expires_in}, scope=${response.data.scope}`);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [GoogleOAuthService] exchangeCodeForTokens - Token exchange failed`);
      console.error(`❌ [GoogleOAuthService] exchangeCodeForTokens - Status: ${error.response?.status}`);
      console.error(`❌ [GoogleOAuthService] exchangeCodeForTokens - Error data:`, JSON.stringify(error.response?.data, null, 2));
      console.error(`❌ [GoogleOAuthService] exchangeCodeForTokens - Error message: ${error.message}`);
      throw error;
    }
  }

  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    console.log(`🔄 [GoogleOAuthService] getUserInfo - Fetching user info from Google API`);
    console.log(`🔄 [GoogleOAuthService] getUserInfo - Access token: ${accessToken.substring(0, 20)}...`);
    const response = await axios.get<GoogleUserInfo>(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    console.log(`✅ [GoogleOAuthService] getUserInfo - User info retrieved: email=${response.data.email}, id=${response.data.id}, name=${response.data.name}`);
    return response.data;
  }

  async decodeIdToken(idToken: string): Promise<GoogleUserInfo | null> {
    console.log(`🔄 [GoogleOAuthService] decodeIdToken - Decoding ID token`);
    console.log(`🔄 [GoogleOAuthService] decodeIdToken - ID token: ${idToken.substring(0, 30)}...`);
    try {
      // Decode JWT without verification (Google's ID tokens are signed)
      // In production, you should verify the token signature
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        console.error(`❌ [GoogleOAuthService] decodeIdToken - Invalid ID token format (expected 3 parts, got ${parts.length})`);
        return null;
      }

      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );

      const userInfo = {
        id: payload.sub,
        email: payload.email,
        verified_email: payload.email_verified || false,
        name: payload.name || '',
        picture: payload.picture || '',
        given_name: payload.given_name || '',
        family_name: payload.family_name || '',
      };

      console.log(`✅ [GoogleOAuthService] decodeIdToken - ID token decoded: email=${userInfo.email}, id=${userInfo.id}, name=${userInfo.name}`);
      return userInfo;
    } catch (error: any) {
      console.error(`❌ [GoogleOAuthService] decodeIdToken - Failed to decode ID token: ${error.message}`);
      return null;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
    if (!this.isEnabled) {
      throw new Error(
        'Google OAuth is not configured. Please set required environment variables.',
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
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

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
      refresh_token: response.data.refresh_token, // May or may not be present
    };
  }
}
