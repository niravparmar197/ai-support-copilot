/*
  Warnings:

  - Added the required column `password_hash` to the `customers` table without a default value. This is not possible if the table is not empty.

*/
-- No DROP INDEX "document_chunks_embedding_idx" here, deliberately: that's
-- the same recurring Prisma-diff-vs-ivfflat-index drift documented in
-- 20260818011312_restore_document_chunks_embedding_index — dropping it
-- again would just require another restore migration. See that file's
-- comment for the full story.

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "must_reset_password" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "password_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
