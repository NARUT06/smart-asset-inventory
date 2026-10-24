-- CreateTable
CREATE TABLE "RiskHistory" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" VARCHAR(20) NOT NULL,
    "failurePredicted" BOOLEAN NOT NULL DEFAULT false,
    "factors" JSONB NOT NULL DEFAULT '{}',
    "recommendations" VARCHAR(1000),
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskHistory_assetId_idx" ON "RiskHistory"("assetId");

-- CreateIndex
CREATE INDEX "RiskHistory_assessedAt_idx" ON "RiskHistory"("assessedAt");

-- AddForeignKey
ALTER TABLE "RiskHistory" ADD CONSTRAINT "RiskHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
