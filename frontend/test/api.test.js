import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('listagem usa /api, credenciais e sinal de cancelamento', async () => {
  const documents = [{ id: 'document-1', originalName: 'arquivo.txt' }];
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.signal, controller.signal);
    return Response.json({ documents });
  };
  assert.deepEqual(await listDocuments({ signal: controller.signal }), documents);
});

test('upload envia somente file via FormData sem definir Content-Type', async () => {
  const document = { id: 'document-1', originalName: 'arquivo.txt' };
  const file = new File(['conteudo'], 'arquivo.txt', { type: 'text/plain' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.deepEqual([...options.body.keys()], ['file']);
    assert.equal(options.body.get('file').name, file.name);
    assert.equal(await options.body.get('file').text(), 'conteudo');
    assert.equal(options.headers, undefined);
    return Response.json({ document }, { status: 201 });
  };
  assert.deepEqual(await uploadDocument(file), document);
});

test('download codifica identificador e retorna conteúdo binário', async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/documents/id%2Fespecial/download');
    return new Response('conteudo', { headers: { 'Content-Type': 'text/plain' } });
  };
  const blob = await downloadDocument('id/especial');
  assert.equal(await blob.text(), 'conteudo');
  assert.equal(blob.type, 'text/plain');
});

test('propaga mensagem estruturada de erro da API', async () => {
  globalThis.fetch = async () => Response.json({ error: { message: 'Arquivo excede o limite.' } }, { status: 413 });
  await assert.rejects(uploadDocument(new File(['texto'], 'arquivo.txt')), /Arquivo excede o limite/);
});

test('trata sessão ausente e erro sem corpo JSON', async () => {
  globalThis.fetch = async () => new Response('', { status: 401 });
  await assert.rejects(listDocuments(), /sessão autenticada/);
  globalThis.fetch = async () => new Response('Bad Gateway', { status: 502 });
  await assert.rejects(listDocuments(), /Não foi possível concluir/);
});

test('trata falha de rede e preserva cancelamento', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(listDocuments(), /Não foi possível conectar/);
  const abortError = new DOMException('Cancelado', 'AbortError');
  globalThis.fetch = async () => { throw abortError; };
  await assert.rejects(listDocuments(), (error) => error === abortError);
});