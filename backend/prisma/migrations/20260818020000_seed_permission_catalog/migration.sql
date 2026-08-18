-- Data migration, not a schema change: populates the Permission catalog
-- documented in the schema.prisma comment above `model Permission` (D-010,
-- D-011, D-012), plus one RolePermission grant (approval.approve/reject ->
-- COMPANY_ADMIN) so the sidebar's existing permission-gated "Approvals"
-- item has something real to check against. Idempotent (ON CONFLICT DO
-- NOTHING) so it's safe to re-run. No seed.ts here deliberately — this repo
-- has no prisma-seed pipeline yet, and adding one is a bigger call than one
-- catalog of reference rows needs.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  ('perm_customer_manage', 'customer.manage', 'Create, edit, and manage customer records'),
  ('perm_document_upload', 'document.upload', 'Upload knowledge base documents'),
  ('perm_document_delete', 'document.delete', 'Delete knowledge base documents'),
  ('perm_approval_approve', 'approval.approve', 'Approve pending approval requests'),
  ('perm_approval_reject', 'approval.reject', 'Reject pending approval requests'),
  ('perm_ai_copilot_use', 'ai.copilot.use', 'Use the AI copilot for ticket assistance'),
  ('perm_platform_company_manage', 'platform.company.manage', 'Manage companies at the platform level')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role", "permission_id")
SELECT 'rp_company_admin_approval_approve', 'COMPANY_ADMIN', "id" FROM "permissions" WHERE "key" = 'approval.approve'
ON CONFLICT ("role", "permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role", "permission_id")
SELECT 'rp_company_admin_approval_reject', 'COMPANY_ADMIN', "id" FROM "permissions" WHERE "key" = 'approval.reject'
ON CONFLICT ("role", "permission_id") DO NOTHING;
