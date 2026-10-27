import { File, Files, RefreshCw } from 'lucide-react';
import DownloadButton from './DownloadButton.jsx';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const sizeFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} KB`;
  return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
}

export default function DocumentList({ documents, loading, error, onRefresh }) {
  return (
    <section className="documents-section" aria-labelledby="documents-heading" aria-busy={loading}>
      <div className="section-heading">
        <div className="heading-with-count">
          <h2 id="documents-heading">Meus documentos</h2>
          <span className="document-count">{documents.length}</span>
        </div>
        <button type="button" className="icon-button" onClick={onRefresh} disabled={loading} title="Atualizar documentos" aria-label="Atualizar documentos">
          <RefreshCw size={18} className={loading ? 'spinning' : undefined} aria-hidden="true" />
        </button>
      </div>
      {error && <div className="list-error"><p className="feedback error" role="alert">{error}</p><button type="button" className="text-button" onClick={onRefresh} disabled={loading}>Tentar novamente</button></div>}
      <p className="loading-status" role="status">{loading ? 'Carregando documentos...' : ''}</p>
      {!loading && !error && documents.length === 0 && (
        <div className="empty-state"><Files size={36} strokeWidth={1.3} aria-hidden="true" /><p>Nenhum documento disponível.</p></div>
      )}
      {documents.length > 0 && (
        <ul className="document-list">
          {documents.map((document) => (
            <li className="document-row" key={document.id}>
              <span className="file-icon"><File size={22} strokeWidth={1.5} aria-hidden="true" /></span>
              <div className="document-details">
                <h3>{document.originalName}</h3>
                <div className="document-metadata"><span>{formatSize(document.size)}</span><time dateTime={document.uploadedAt}>{dateFormatter.format(new Date(document.uploadedAt))}</time></div>
              </div>
              <DownloadButton document={document} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}