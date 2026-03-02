import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { User } from '../entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Redirect to GitHub OAuth authorization page.
   */
  @Get('github')
  githubLogin(@Res() res: Response) {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: process.env.GITHUB_CALLBACK_URL || '',
      scope: 'read:user user:email',
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  }

  /**
   * GitHub OAuth callback — exchange code, issue JWT, redirect to frontend.
   */
  @Get('github/callback')
  async githubCallback(@Query('code') code: string, @Res() res: Response) {
    const result = await this.authService.handleGitHubCallback(code);

    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }

  /**
   * Return the current authenticated user's profile.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }

  /**
   * Clear the auth cookie.
   */
  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('access_token');
    res.json({ message: 'Logged out' });
  }

  /**
   * Issue a new access token from an existing one.
   */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
