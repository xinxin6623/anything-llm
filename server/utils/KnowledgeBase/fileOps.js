const fs = require("fs");
const path = require("path");
const { KBIndexer } = require("./indexer");
const { prisma } = require("./db");

async function renameFile(fileId, newName) {
  const file = await KBIndexer.getFileById(fileId);
  if (!file) throw new Error("File not found in index");
  const dir = path.dirname(file.file_path);
  const newPath = path.join(dir, newName);
  if (fs.existsSync(newPath))
    throw new Error(`File already exists: ${newName}`);

  await KBIndexer.logOperation(
    "rename",
    fileId,
    { file_path: file.file_path, file_name: file.file_name },
    { file_path: newPath, file_name: newName }
  );
  fs.renameSync(file.file_path, newPath);
  await prisma.kb_files.update({
    where: { id: fileId },
    data: { file_path: newPath, file_name: newName },
  });
  return { success: true, new_path: newPath };
}

async function moveFile(fileId, targetDir) {
  const file = await KBIndexer.getFileById(fileId);
  if (!file) throw new Error("File not found in index");
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const newPath = path.join(targetDir, file.file_name);
  if (fs.existsSync(newPath))
    throw new Error(`File already exists at target: ${newPath}`);

  await KBIndexer.logOperation(
    "move",
    fileId,
    { file_path: file.file_path },
    { file_path: newPath }
  );
  fs.renameSync(file.file_path, newPath);
  await prisma.kb_files.update({
    where: { id: fileId },
    data: { file_path: newPath },
  });
  return { success: true, new_path: newPath };
}

async function rollbackOperation(operationId) {
  const op = await prisma.kb_operations.findUnique({
    where: { id: operationId },
  });
  if (!op) throw new Error("Operation not found");
  if (op.rolled_back) throw new Error("Already rolled back");

  const oldValue = JSON.parse(op.old_value || "{}");
  const newValue = JSON.parse(op.new_value || "{}");

  if (
    (op.operation === "rename" || op.operation === "move") &&
    newValue.file_path
  ) {
    if (fs.existsSync(newValue.file_path)) {
      fs.renameSync(newValue.file_path, oldValue.file_path);
      await prisma.kb_files.update({
        where: { id: op.file_id },
        data: {
          file_path: oldValue.file_path,
          file_name: oldValue.file_name || path.basename(oldValue.file_path),
        },
      });
    }
  }

  await prisma.kb_operations.update({
    where: { id: operationId },
    data: { rolled_back: 1 },
  });
  return { success: true };
}

module.exports = { renameFile, moveFile, rollbackOperation };
