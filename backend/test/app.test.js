const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { mkdtemp, readdir, readFile, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const express = require('express');

let app;
let repository;
let server;
let baseUrl;
let storageDirectory;
const previousStorage = process.env.STORAGE_DIR;
const previousLimit = process.env.MAX_FILE_SIZE_BYTES;

before(async () => {
  storageDirectory = await mkdtemp(path.join(tmpdir(), 'dms-test-'));
  process.env.STORAGE_DIR = storageDirectory;
  process.env.MAX_FILE_SIZE_BYTES = '64';
  app = require('../src/app');
  repository = require('../src/repositories/documentRepository');
  const harness = express();
  harness.use((req, res, next) => {
    const identities = { alice: 'user-alice', bob: 'user-bob' };
    const owner = identities[req.headers['x-test-user']];
    if (owner) req.user = { id: owner };
    next();
  });
  harness.use(app);
  server = harness.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
  if (previousStorage === undefined) delete process.env.STORAGE_DIR;
  else process.env.STORAGE_DIR = previousStorage;
  if (previousLimit === undefined) delete process.env.MAX_FILE_SIZE_BYTES;
  else process.env.MAX_FILE_SIZE_BYTES = previousLimit;
});

function uploadFile({ content = 'conteudo do documento', field = 'file', count = 1 } = {}) {
  const form = new FormData();
  for (let index = 0; index < count; index += 1) {
    form.append(field, new Blob([content], { type: 'text/plain' }), 'relatorio.txt');
  }
  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'x-test-user': 'alice' },
    body: form,
  });
}

test('o app backend é exportado e mantém a rota de saúde', async () => {
  assert.strictEqual(typeof app, 'function');
  const response = await fetch(`${baseUrl}/health`);
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { status: 'ok' });
});

test('rotas protegidas rejeitam identidade ausente ou enviada pelo cliente', async () => {
  const initialFiles = await readdir(storageDirectory);
  for (const [endpoint, method] of [
    ['/upload', 'POST'],
    ['/documents', 'GET'],
    [`/documents/${randomUUID()}/download`, 'GET'],
  ]) {
    const response = await fetch(`${baseUrl}${endpoint}?owner=alice`, {
      method,
      headers: { 'x-user-id': 'alice' },
    });
    assert.strictEqual(response.status, 401);
    assert.strictEqual((await response.json()).error.code, 'UNAUTHORIZED');
  }
  assert.deepStrictEqual(await readdir(storageDirectory), initialFiles);
});

test('upload grava arquivo local, lista por dono e permite download do conteúdo', async () => {
  const response = await uploadFile();
  assert.strictEqual(response.status, 201);
  const { document } = await response.json();
  assert.deepStrictEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
  assert.strictEqual(document.originalName, 'relatorio.txt');
  assert.strictEqual(document.owner, 'user-alice');
  assert.strictEqual(document.size, Buffer.byteLength('conteudo do documento'));
  assert.ok(Number.isFinite(Date.parse(document.uploadedAt)));
  const files = await readdir(storageDirectory);
  assert.strictEqual(files.length, 1);
  assert.notStrictEqual(files[0], document.originalName);
  assert.strictEqual(await readFile(path.join(storageDirectory, files[0]), 'utf8'), 'conteudo do documento');

  const secondResponse = await uploadFile({ content: 'segundo' });
  const secondDocument = (await secondResponse.json()).document;
  const listResponse = await fetch(`${baseUrl}/documents`, { headers: { 'x-test-user': 'alice' } });
  assert.deepStrictEqual((await listResponse.json()).documents, [secondDocument, document]);
  const otherList = await fetch(`${baseUrl}/documents`, { headers: { 'x-test-user': 'bob' } });
  assert.deepStrictEqual(await otherList.json(), { documents: [] });

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'x-test-user': 'alice' },
  });
  assert.strictEqual(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment;.*relatorio\.txt/);
  assert.strictEqual(await download.text(), 'conteudo do documento');
  for (const id of [document.id, randomUUID()]) {
    const forbidden = await fetch(`${baseUrl}/documents/${id}/download`, {
      headers: { 'x-test-user': 'bob' },
    });
    assert.strictEqual(forbidden.status, 404);
    assert.strictEqual((await forbidden.json()).error.code, 'NOT_FOUND');
  }
  await rm(path.join(storageDirectory, files[0]));
  const missing = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'x-test-user': 'alice' },
  });
  assert.strictEqual(missing.status, 404);
});

test('valida arquivo, campo, quantidade, tamanho e identificador', async () => {
  const initialFiles = await readdir(storageDirectory);
  const absent = await fetch(`${baseUrl}/upload`, { method: 'POST', headers: { 'x-test-user': 'alice' } });
  assert.strictEqual(absent.status, 400);
  assert.strictEqual((await absent.json()).error.code, 'VALIDATION_ERROR');
  for (const options of [{ field: 'other' }, { count: 2 }, { content: 'x'.repeat(65) }]) {
    const response = await uploadFile(options);
    assert.strictEqual(response.status, options.content ? 413 : 400);
    assert.ok((await response.json()).error.message);
  }
  assert.deepStrictEqual(await readdir(storageDirectory), initialFiles);
  const invalid = await fetch(`${baseUrl}/documents/invalid/download`, { headers: { 'x-test-user': 'alice' } });
  assert.strictEqual(invalid.status, 400);
});

test('falha de metadados remove o arquivo e não expõe detalhes internos', async () => {
  const initialFiles = await readdir(storageDirectory);
  const originalSave = repository.save;
  repository.save = () => { throw new Error('detalhes internos'); };
  try {
    const response = await uploadFile();
    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(await response.json(), {
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' },
    });
    assert.deepStrictEqual(await readdir(storageDirectory), initialFiles);
  } finally {
    repository.save = originalSave;
  }
});

test('falha de escrita no armazenamento retorna erro sem sucesso parcial', async () => {
  await rm(storageDirectory, { recursive: true });
  await writeFile(storageDirectory, 'não é um diretório');
  const response = await uploadFile();
  assert.strictEqual(response.status, 500);
  assert.strictEqual((await response.json()).error.code, 'INTERNAL_ERROR');
});
