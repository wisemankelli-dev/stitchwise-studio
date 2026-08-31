-- CreateTable
CREATE TABLE "QuiltBlockProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "blockSize" REAL NOT NULL DEFAULT 12,
    "gridRows" INTEGER NOT NULL DEFAULT 4,
    "gridCols" INTEGER NOT NULL DEFAULT 4,
    "thumbnail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuiltBlockProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
