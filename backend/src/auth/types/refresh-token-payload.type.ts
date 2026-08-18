// sessionId identifies which UserSession row to check — bcrypt hashes are
// salted, so there's no way to query "the row whose hash matches this
// token" directly; the token has to say which row to compare against.
//
// impersonatorId (D-026): carried through refresh so an impersonation
// session doesn't silently turn into an ordinary one the first time it
// rotates — see AuthService.refresh() passing it through to login().
export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  impersonatorId?: string;
}
