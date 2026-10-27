const path = require('node:path');
const { mkdir, stat, unlink } = require('node:fs/promises');

const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../../storage'),
);
const documents = new Map();

async function ensureStorageDirectory() {
  await mkdir(storageDirectory, { recursive: true });
  return storageDirectory;
}

function save(document) {
  documents.set(document.id, { ...document });
  return { ...document };
}

function findByOwner(owner) {
  return Array.from(documents.values())
    .filter((document) => document.owner === owner)
    .reverse()
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt))
    .map((document) => ({ ...document }));
}

function findById(id) {
  const document = documents.get(id);
  return document ? { ...document } : null;
}

function getFilePath(storedFilename) {
  return path.join(storageDirectory, storedFilename);
}

async function findFile(storedFilename) {
  const filePath = getFilePath(storedFilename);
  const information = await stat(filePath);
  if (!information.isFile()) {
    throw Object.assign(new Error('Arquivo indisponível.'), { code: 'ENOENT' });
  }
  return filePath;
}

async function removeFile(storedFilename) {
  await unlink(getFilePath(storedFilename));
}

module.exports = {
  ensureStorageDirectory,
  save,
  findByOwner,
  findById,
  findFile,
  removeFile,
};