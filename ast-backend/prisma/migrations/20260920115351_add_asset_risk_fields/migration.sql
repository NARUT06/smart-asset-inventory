-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "failurePredicted" BOOLEAN DEFAULT false,
ADD COLUMN     "riskLevel" VARCHAR(20),
ADD COLUMN     "riskScore" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Asset_riskScore_idx" ON "Asset"("riskScore");
