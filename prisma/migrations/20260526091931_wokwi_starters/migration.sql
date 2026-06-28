-- CreateTable
CREATE TABLE "WokwiStarter" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "board" TEXT NOT NULL DEFAULT 'esp32',
    "category" TEXT,
    "wokwiProjectUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WokwiStarter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WokwiStarter_label_key" ON "WokwiStarter"("label");

-- CreateIndex
CREATE INDEX "WokwiStarter_published_order_idx" ON "WokwiStarter"("published", "order");
