-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "cashCountedCents" INTEGER,
ADD COLUMN     "cashExpectedCents" INTEGER,
ADD COLUMN     "cashVarianceCents" INTEGER,
ADD COLUMN     "openingFloatCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovementBatch" ADD COLUMN     "shiftId" UUID;

-- CreateTable
CREATE TABLE "ShiftOpeningStock" (
    "id" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "openingQuantity" INTEGER NOT NULL,

    CONSTRAINT "ShiftOpeningStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftOpeningStock_productId_shiftId_idx" ON "ShiftOpeningStock"("productId", "shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOpeningStock_shiftId_productId_key" ON "ShiftOpeningStock"("shiftId", "productId");

-- AddForeignKey
ALTER TABLE "StockMovementBatch" ADD CONSTRAINT "StockMovementBatch_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOpeningStock" ADD CONSTRAINT "ShiftOpeningStock_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOpeningStock" ADD CONSTRAINT "ShiftOpeningStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
