// __Host- prefix requires Secure, no Domain attribute, Path=/ — see Q1 in
// the design discussion. Cookie names are fixed constants, not env-driven,
// deliberately: an env-driven name would reintroduce the dev/prod dual code
// path this design is meant to avoid.
export const ACCESS_TOKEN_COOKIE = '__Host-access_token';
export const REFRESH_TOKEN_COOKIE = '__Host-refresh_token';

// Separate cookie names (D-029) so a customer and a staff member logged in
// on the same browser/origin never collide, and so the two auth systems
// stay unambiguous at the transport level, not just by secret.
export const CUSTOMER_ACCESS_TOKEN_COOKIE = '__Host-customer_access_token';
export const CUSTOMER_REFRESH_TOKEN_COOKIE = '__Host-customer_refresh_token';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const BCRYPT_SALT_ROUNDS = 12;
