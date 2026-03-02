import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { GitHubProfile } from '../interfaces/github-profile.interface';

@Injectable()
export class GitHubOAuthService {
  private readonly clientId = process.env.GITHUB_CLIENT_ID;
  private readonly clientSecret = process.env.GITHUB_CLIENT_SECRET;

  /**
   * Exchange an OAuth authorization code for a GitHub access token.
   */
  async exchangeCode(code: string): Promise<string> {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error || !data.access_token) {
      throw new UnauthorizedException(
        data.error_description ?? 'GitHub OAuth code exchange failed',
      );
    }

    return data.access_token;
  }

  /**
   * Fetch the authenticated user's GitHub profile.
   */
  async getProfile(accessToken: string): Promise<GitHubProfile> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub profile');
    }

    return res.json() as Promise<GitHubProfile>;
  }
}
