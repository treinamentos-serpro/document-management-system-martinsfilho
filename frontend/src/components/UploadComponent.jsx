import { useId, useRef, useState } from 'react';
import { FileUp, LoaderCircle, Upload, X } from 'lucide-react';
import { uploadDocument } from '../services/api.js';

export default function UploadComponent({ onUploaded }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function selectFile(event) {
    setFile(event.target.files[0] || null);
    setError('');
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const document = await uploadDocument(file);
      setSuccess(`Documento enviado: ${document.originalName}`);
      setFile(null);
      inputRef.current.value = '';
      onUploaded(document);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading(false);
    }
  }

  function clearFile() {
    setFile(null);
    setError('');
    inputRef.current.value = '';
  }

  return (
    <section className="upload-section" aria-labelledby="upload-heading">
      <div className="section-heading">
        <h2 id="upload-heading">Novo documento</h2>
      </div>
      <form className="upload-form" onSubmit={submit} aria-busy={uploading}>
        <div className="file-picker">
          <FileUp size={28} strokeWidth={1.5} aria-hidden="true" />
          <div className="file-picker-content">
            <label htmlFor={inputId}>Arquivo</label>
            <input ref={inputRef} id={inputId} type="file" onChange={selectFile} disabled={uploading} />
          </div>
          {file && (
            <button type="button" className="icon-button" onClick={clearFile} disabled={uploading} title="Remover seleção" aria-label="Remover seleção">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <button type="submit" className="primary-button" disabled={!file || uploading}>
          {uploading ? <LoaderCircle className="spinning" size={18} aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
          {uploading ? 'Enviando...' : 'Enviar documento'}
        </button>
      </form>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <p className="feedback success" role="status">{success}</p>
    </section>
  );
}