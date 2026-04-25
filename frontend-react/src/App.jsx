import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import './index.css'

const API_URL = 'http://localhost:8000'

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hola 👋 Soy tu asistente de Física. El material ya está cargado desde la carpeta del proyecto. ¡Haceme una pregunta!',
      sources: [],
    }
  ])
  const [inputValue, setInputValue]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [ingesting, setIngesting]     = useState(false)
  const [docsInfo, setDocsInfo]       = useState({ documents: [], indexed: [], pending: [] })
  const chatBottomRef                 = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const fetchDocs = async () => {
    try {
      const res  = await fetch(`${API_URL}/documents`)
      const data = await res.json()
      setDocsInfo(data)
    } catch {
      // servidor aún no arrancó
    }
  }

  useEffect(() => {
    fetchDocs()
  }, [])

  const handleIngest = async () => {
    setIngesting(true)
    try {
      const res  = await fetch(`${API_URL}/ingest`, { method: 'POST' })
      const data = await res.json()

      if (data.new > 0) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `📚 ${data.new} PDF(s) nuevo(s) indexados:\n${data.files.map(f => `• ${f.file} (${f.pages} pág., ${f.chunks} fragmentos)`).join('\n')}`,
          sources: [],
        }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✔ Todo al día. ${data.total} documento(s) cargado(s), sin novedades.`,
          sources: [],
        }])
      }
      await fetchDocs()
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ No se pudo conectar con el servidor. ¿Está corriendo el backend?',
        sources: [],
      }])
    } finally {
      setIngesting(false)
    }
  }

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || loading) return

    setMessages(prev => [...prev, { role: 'user', content: text, sources: [] }])
    setInputValue('')
    setLoading(true)

    try {
      const res  = await fetch(`${API_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Error del servidor.')

      setMessages(prev => [...prev, {
        role:    'assistant',
        content:  data.response,
        sources:  data.sources || [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ ${err.message}`,
        sources: [],
      }])
    } finally {
      setLoading(false)
    }
  }

  const indexedCount = docsInfo.indexed?.length  || 0
  const pendingCount = docsInfo.pending?.length   || 0

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <div className="header">
        <div className="header-left">
          <span className="logo">⚛️</span>
          <div>
            <h1>Agente de Física</h1>
            <p className="subtitle">RAG · Gemini · Solo responde con tu material</p>
          </div>
        </div>
        <button
          className={`ingest-btn ${pendingCount > 0 ? 'has-pending' : ''}`}
          onClick={handleIngest}
          disabled={ingesting || loading}
          title="Indexar PDFs nuevos en docs/ sin reiniciar el servidor"
        >
          {ingesting ? '⏳ Indexando...' : pendingCount > 0 ? `🔄 Indexar ${pendingCount} nuevo(s)` : '🔄 Refrescar docs'}
        </button>
      </div>

      {/* ── Barra de documentos (Compacta y Scrolleable) ── */}
      <div className="docs-bar-container">
        <div className="docs-bar">
          {indexedCount === 0 ? (
            <span className="no-docs">
              ⚠️ Sin material cargado — copiá PDFs a <code>backend-python/docs/</code>
            </span>
          ) : (
            <>
              <span className="docs-label">Material ({indexedCount}):</span>
              <div className="docs-scroll">
                {docsInfo.indexed.map(d => (
                  <span key={d} className="doc-badge">📄 {d}</span>
                ))}
              </div>
              {pendingCount > 0 && (
                <span className="doc-badge pending">⏳ {pendingCount} nuevos</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Chat ── */}
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            {msg.sources?.length > 0 && (
              <details className="sources-details">
                <summary>📎 Referencias del material</summary>
                <div className="sources-list">
                  {msg.sources.map((s, i) => (
                    <div key={i} className="source-item">
                      <strong>{s.source}</strong> (Pág. {+s.page + 1})
                      <span>{s.snippet}...</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant loading-msg">
            <div className="dot" /><div className="dot" /><div className="dot" />
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="input-area">
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Preguntá sobre el material de física..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !inputValue.trim()}>
          Enviar
        </button>
      </div>
    </div>
  )
}

export default App
