export interface JwtPayload {
  sub: string; // user.id (UUID)
  githubId: string;
  username: string;
  iat?: number;
  exp?: number;
}
