export interface JwtPayload {
  sub: string; // user.id (UUID)
  username: string;
  iat?: number;
  exp?: number;
}
