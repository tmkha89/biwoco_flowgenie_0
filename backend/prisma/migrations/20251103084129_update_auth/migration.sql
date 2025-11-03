/*
  Warnings:

  - You are about to drop the column `scope` on the `oauth_accounts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "oauth_accounts" DROP COLUMN "scope";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleLinked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL;
