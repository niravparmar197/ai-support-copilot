// sessionId identifies which UserSession row to check — bcrypt hashes are
// salted, so there's no way to query "the row whose hash matches this
// token" directly; the token has to say which row to compare against.
export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
}
