import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'

const TYPE_ICON = { pdf: '📄', txt: '📝', docx: '📋', url: '🌐', image: '🖼️' }

const DocumentUpload = ({ isOpen, onClose }) => {
  const { axios, token, user } = useAppContext()
  const fileRef = useRef(null)

  const [docs, setDocs] = useState([])
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [isGlobal, setIsGlobal] = useState(false)

  useEffect(() => {
    if (isOpen) fetchDocs()
  }, [isOpen])

  const fetchDocs = async () => {
    try {
      const { data } = await axios.get('/api/document/list', {
        headers: { Authorization: token },
      })
      if (data.success) setDocs(data.documents)
    } catch {
      // silent
    }
  }

  const handleFileUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('isGlobal', String(isGlobal))
      const { data } = await axios.post('/api/document/upload', form, {
        headers: { Authorization: token, 'Content-Type': 'multipart/form-data' },
      })
      if (data.success) {
        toast.success(data.message)
        setDocs(prev => [data.document, ...prev])
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleUrlSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setUploading(true)
    try {
      const { data } = await axios.post(
        '/api/document/upload',
        { url: url.trim(), isGlobal },
        { headers: { Authorization: token } }
      )
      if (data.success) {
        toast.success(data.message)
        setDocs(prev => [data.document, ...prev])
        setUrl('')
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'URL ingestion failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      const { data } = await axios.delete(`/api/document/${id}`, {
        headers: { Authorization: token },
      })
      if (data.success) {
        toast.success('Document removed')
        setDocs(prev => prev.filter(d => d._id !== id))
      }
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass rounded-3xl w-full max-w-lg p-6 shadow-premium flex flex-col gap-5 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-text">📚 Study Materials</h2>
            <p className="text-xs text-muted mt-0.5">Upload PDF, TXT, DOCX, image or paste a URL — scanned files are OCR-read</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-accent/10 transition-all text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* File drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]) }}
          className="border-2 border-dashed border-border/60 rounded-2xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/[0.02] transition-all"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={e => handleFileUpload(e.target.files[0])}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted font-semibold">Embedding document…</p>
            </div>
          ) : (
            <>
              <p className="text-3xl mb-2">📂</p>
              <p className="text-sm font-bold text-text">Drop file here or click to browse</p>
              <p className="text-xs text-muted mt-1">PDF · TXT · DOCX · Image · up to 10 MB</p>
            </>
          )}
        </div>

        {/* URL input */}
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste a URL (article, docs, blog…)"
            className="flex-1 bg-surface/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm outline-none placeholder-muted focus:border-accent/50 transition-all"
          />
          <button
            type="submit"
            disabled={uploading || !url.trim()}
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-all"
          >
            Add
          </button>
        </form>

        {/* Global toggle — admin only (shared pool affects every user) */}
        {user?.isAdmin && (
          <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none -mt-1">
            <input
              type="checkbox"
              checked={isGlobal}
              onChange={e => setIsGlobal(e.target.checked)}
              className="accent-accent w-4 h-4 rounded"
            />
            <span className="text-xs font-semibold text-muted">
              Make available to everyone <span className="text-accent font-bold">(Global)</span>
            </span>
          </label>
        )}

        {/* Document list */}
        {docs.length > 0 && (
          <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
              Your Documents ({docs.length})
            </p>
            {docs.map(doc => (
              <div
                key={doc._id}
                className="flex items-center gap-3 p-3 glass rounded-xl border border-border/30"
              >
                <span className="text-lg">{TYPE_ICON[doc.fileType] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text truncate">{doc.fileName}</p>
                  <p className="text-[10px] text-muted">
                    {doc.chunkCount} chunks · {doc.fileType.toUpperCase()}
                    {doc.isGlobal && <span className="text-accent font-bold"> · 🌐 Global</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc._id)}
                  disabled={deleting === doc._id}
                  className="text-xs text-red-400 hover:text-red-500 font-bold disabled:opacity-40 transition-all"
                >
                  {deleting === doc._id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        {docs.length === 0 && !uploading && (
          <p className="text-xs text-center text-muted py-2">
            No documents yet. Upload study material to enable Study AI.
          </p>
        )}
      </div>
    </div>
  )
}

export default DocumentUpload
