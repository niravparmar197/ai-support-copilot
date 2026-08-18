// Computed fresh on every request by JwtStrategy.validate() from the access
// token's impersonatorId claim plus the impersonated user's own (already
// fetched) tenant relation — never persisted as its own column. See D-026.
export interface ImpersonatedBy {
  userId: string;
  companyId: string;
  companyName: string;
}
