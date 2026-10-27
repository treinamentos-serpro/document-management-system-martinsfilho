const multer = require('multer');
const { randomUUID } = require('node:crypto');
const service = require('../services/documentService');

const maxFileSize = Number(process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024);
if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

const receiveFile = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      service.prepareStorage().then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      );
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  limits: { fileSize: maxFileSize, files: 1 },
}).single('file');

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function requireUser(req, res, next) {
  if (typeof req.user?.id !== 'string' || !req.user.id.trim()) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Identidade de usuário necessária.');
  }
  next();
}

async function upload(req, res) {
  if (!req.file) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Envie um arquivo no campo file.');
  }
  const document = await service.upload(req.file, req.user.id);
  res.status(201).json({ document });
}

function list(req, res) {
  res.json({ documents: service.list(req.user.id) });
}

async function download(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Identificador de documento inválido.');
  }
  const document = await service.download(req.params.id, req.user.id);
  res.download(document.filePath, document.originalName, (error) => {
    if (error) next(error);
  });
}

function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'O arquivo excede o tamanho permitido.');
    }
    return sendError(res, 400, 'VALIDATION_ERROR', 'Envie apenas um arquivo no campo file.');
  }
  if (['NOT_FOUND', 'ENOENT', 'ENOTDIR'].includes(error.code) && req.method === 'GET') {
    return sendError(res, 404, 'NOT_FOUND', 'Documento não encontrado.');
  }
  if (error.message?.startsWith('Multipart:') || error.message === 'Unexpected end of form') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Requisição multipart inválida.');
  }
  return sendError(res, 500, 'INTERNAL_ERROR', 'Não foi possível concluir a operação.');
}

module.exports = { requireUser, receiveFile, upload, list, download, handleError };