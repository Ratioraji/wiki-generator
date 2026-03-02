import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GitHubOAuthService } from './github-oauth.service';
import { UserService } from './user.service';
import { AuthResponseDto } from '../dto/auth-response.dto';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { User } from '../entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly githubOAuth: GitHubOAuthService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Full OAuth callback flow:
   * 1. Exchange code for GitHub access token
   * 2. Fetch GitHub user profile
   * 3. Upsert user in database
   * 4. Sign JWT
   * 5. Return auth response
   */
  async handleGitHubCallback(code: string): Promise<AuthResponseDto> {
    const accessToken = await this.githubOAuth.exchangeCode(code);
    const profile = await this.githubOAuth.getProfile(accessToken);
    const user = await this.userService.upsertFromGitHub(profile, accessToken);

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      githubId: user.githubId,
      username: user.username,
    };

    const jwt = this.jwtService.sign(payload);

    return {
      accessToken: jwt,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Validate a JWT payload and return the corresponding user.
   */
  async validateToken(payload: JwtPayload): Promise<User> {
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  /**
   * Verify and re-sign a token to extend the session.
   */
  async refreshToken(token: string): Promise<{ accessToken: string }> {
    const payload = this.jwtService.verify<JwtPayload>(token);
    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const newPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      githubId: user.githubId,
      username: user.username,
    };

    return { accessToken: this.jwtService.sign(newPayload) };
  }
}
