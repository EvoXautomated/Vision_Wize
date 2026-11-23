-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "searchKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Client_searchKey_idx" ON "Client"("searchKey");
