-- Model IDs and resolutions are fixed in application code. Keep only the
-- administrator-controlled per-second price for each fixed combination.
PRAGMA foreign_keys=off;
CREATE TABLE "new_VideoPricingRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "creditsPerSecond" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_VideoPricingRule" ("id", "model", "resolution", "creditsPerSecond", "createdAt", "updatedAt")
SELECT "id", "model", "resolution", "creditsPerSecond", "createdAt", "updatedAt"
FROM "VideoPricingRule";
DROP TABLE "VideoPricingRule";
ALTER TABLE "new_VideoPricingRule" RENAME TO "VideoPricingRule";
CREATE UNIQUE INDEX "VideoPricingRule_model_resolution_key" ON "VideoPricingRule"("model", "resolution");
DELETE FROM "AppSetting" WHERE "key" IN ('provider.openai.chatModel', 'provider.image.model', 'provider.image.baseUrl', 'provider.image.apiKey', 'provider.seedance.model');
DELETE FROM "VideoPricingRule" WHERE "resolution" = '*';
PRAGMA foreign_keys=on;
