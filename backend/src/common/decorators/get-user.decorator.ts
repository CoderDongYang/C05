import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  userId: number;
  username: string;
  email: string;
  roleId: number;
  roleName: string;
  permissions: string[];
}

export const GetUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;
    return data ? user?.[data] : user;
  },
);
