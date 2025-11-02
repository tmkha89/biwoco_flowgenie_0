-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "nextActionId" INTEGER,
ADD COLUMN     "parentActionId" INTEGER;

-- CreateIndex
CREATE INDEX "actions_workflowId_order_idx" ON "actions"("workflowId", "order");

-- CreateIndex
CREATE INDEX "actions_parentActionId_idx" ON "actions"("parentActionId");

-- CreateIndex
CREATE INDEX "actions_nextActionId_idx" ON "actions"("nextActionId");

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_parentActionId_fkey" FOREIGN KEY ("parentActionId") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_nextActionId_fkey" FOREIGN KEY ("nextActionId") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
