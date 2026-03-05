-- CreateTable
CREATE TABLE "kb_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "file_path" TEXT NOT NULL,
    "file_hash" TEXT,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT,
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "sub_category" TEXT,
    "summary" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_msg" TEXT,
    "indexed_at" DATETIME,
    "embedded_at" DATETIME,
    "workspace_slug" TEXT,
    "doc_location" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "kb_operations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "file_id" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "rolled_back" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "kb_files_file_path_key" ON "kb_files"("file_path");

-- CreateIndex
CREATE INDEX "kb_files_status_idx" ON "kb_files"("status");

-- CreateIndex
CREATE INDEX "kb_files_category_idx" ON "kb_files"("category");

-- CreateIndex
CREATE INDEX "kb_files_file_hash_idx" ON "kb_files"("file_hash");
