-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "batchId" UUID;

-- CreateTable
CREATE TABLE "StockMovementBatch" (
    "id" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "supplierId" UUID,
    "reason" TEXT,
    "reference" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockMovementBatch_idempotencyKey_key" ON "StockMovementBatch"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StockMovementBatch_type_createdAt_idx" ON "StockMovementBatch"("type", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovementBatch_createdAt_idx" ON "StockMovementBatch"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StockMovementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
