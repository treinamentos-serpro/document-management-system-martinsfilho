const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documentRepository');

function toPublicDocument(document) {
  const { storedFilename, ...metadata } = document;
  return metadata;
}

async function prepareStorage() {
  return repository.ensureStorageDirectory();
}

async function upload(file, owner) {
  try {
    const document = repository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      storedFilename: file.filename,
    });
    return toPublicDocument(document);
  } catch (error) {
    try {
      await repository.removeFile(file.filename);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Falha ao registrar o documento e remover o arquivo.',
      );
    }
    throw error;
  }
}

function list(owner) {
  return repository.findByOwner(owner).map(toPublicDocument);
}

async function download(id, owner) {
  const document = repository.findById(id);
  if (!document || document.owner !== owner) {
    throw Object.assign(new Error('Documento não encontrado.'), { code: 'NOT_FOUND' });
  }
  return {
    filePath: await repository.findFile(document.storedFilename),
    originalName: document.originalName,
  };
}

module.exports = { prepareStorage, upload, list, download };