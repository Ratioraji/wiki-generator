import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../services/auth.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { User } from '../entities/user.entity';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Try HTTP-only cookie first
        (req: Request) => req?.cookies?.access_token ?? null,
        // 2. Fall back to Authorization: Bearer header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET || 'fallback-dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    return this.authService.validateToken(payload);
  }
}
