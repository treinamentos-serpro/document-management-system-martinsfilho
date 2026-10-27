import { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { downloadDocument } from '../services/api.js';

export default function DownloadButton({ document }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const blob = await downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      try {
        link.href = url;
        link.download = document.originalName;
        window.document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="download-action">
      <button type="button" className="icon-button" disabled={downloading} onClick={download} title={downloading ? 'Baixando...' : `Baixar ${document.originalName}`} aria-label={downloading ? `Baixando ${document.originalName}` : `Baixar ${document.originalName}`}>
        {downloading ? <LoaderCircle className="spinning" size={19} aria-hidden="true" /> : <Download size={19} aria-hidden="true" />}
      </button>
      {error && <p className="feedback error download-error" role="alert">{error}</p>}
    </div>
  );
}