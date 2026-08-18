// __Host- prefix requires Secure, no Domain attribute, Path=/ — see Q1 in
// the design discussion. Cookie names are fixed constants, not env-driven,
// deliberately: an env-driven name would reintroduce the dev/prod dual code
// path this design is meant to avoid.
export const ACCESS_TOKEN_COOKIE = '__Host-access_token';
export const REFRESH_TOKEN_COOKIE = '__Host-refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const BCRYPT_SALT_ROUNDS = 12;
