import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../entities/user.entity';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    return data ? user?.[data] : user;
  },
);
