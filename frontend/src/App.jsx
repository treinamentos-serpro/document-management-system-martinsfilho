import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';
import { listDocuments } from './services/api.js';
import './App.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  function refreshDocuments() {
    setRevision((current) => current + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listDocuments({ signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setDocuments(result);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  return (
    <>
      <header className="app-header"><div className="header-content"><FolderOpen size={24} aria-hidden="true" /><span>DMS</span><span className="header-label">Gestão documental</span></div></header>
      <main className="workspace">
        <div className="page-heading"><p className="eyebrow">ÁREA DE TRABALHO</p><h1>Documentos</h1></div>
        <UploadComponent onUploaded={refreshDocuments} />
        <DocumentList documents={documents} loading={loading} error={error} onRefresh={refreshDocuments} />
      </main>
    </>
  );
}
