const API_PREFIX = '/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      credentials: 'same-origin',
      ...options,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = response.status === 401
      ? 'Acesso não autorizado. Uma sessão autenticada é necessária.'
      : body?.error?.message || 'Não foi possível concluir a operação. Tente novamente.';
    throw new Error(message);
  }
  return response;
}

export async function listDocuments({ signal } = {}) {
  const response = await request('/documents', { signal });
  const { documents } = await response.json();
  return documents;
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', { method: 'POST', body });
  const { document } = await response.json();
  return document;
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}