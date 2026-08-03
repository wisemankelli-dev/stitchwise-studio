-- AlterTable
ALTER TABLE "ShowcasePhoto" ADD COLUMN "projectType" TEXT;

-- CreateTable
CREATE TABLE "EmbroideryPattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gridData" TEXT NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "dmcPalette" TEXT NOT NULL,
    "stitchCount" INTEGER NOT NULL,
    "previewUrl" TEXT,
    "prompt" TEXT,
    "sourceImage" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmbroideryPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
