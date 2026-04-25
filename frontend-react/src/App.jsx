import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Paperclip, Send, X } from 'lucide-react'
import './index.css'

// Si la app está en producción (Vercel), usará la URL de Render. En local, usará localhost.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const COLORS = ['#5865F2', '#F0A500', '#22C55E', '#EC4899', '#06B6D4'];

// --- COMPONENTE DE DIAGRAMA VECTORIAL INTERACTIVO ---
const VectorDiagram = ({ title, elements, zoom: initialZoom = 1.1 }) => {
  const [visibleItems, setVisibleItems] = useState(() => {
    const initialState = {};
    elements.forEach(el => { if (el.label) initialState[el.label] = true; });
    return initialState;
  });

  // Estados para Pan y Zoom
  const [scale, setScale] = useState(75 * initialZoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  const size = 450;
  const center = size / 2;

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 20), 500));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setScale(75 * initialZoom);
    setOffset({ x: 0, y: 0 });
  };

  const toggleItem = (label) => {
    setVisibleItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const labels = Array.from(new Set(elements.filter(el => el.label).map(el => el.label)));

  return (
    <div className="vector-diagram-container">
      <div className="vector-header">
        <div className="vector-title-group">
          <p className="chart-title">{title}</p>
          <button className="reset-btn" onClick={resetView}>Reset Vista</button>
        </div>
        <div className="vector-filters">
          {labels.map(label => (
            <button 
              key={label} 
              className={`filter-btn ${visibleItems[label] ? 'active' : ''}`}
              onClick={() => toggleItem(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      <div 
        className="vector-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg width="100%" height={size} viewBox={`0 0 ${size} ${size}`} className="vector-svg">
          <g transform={`translate(${offset.x}, ${offset.y})`}>
            {/* Ejes Infinitos */}
            <line x1={-2000} y1={center} x2={2000} y2={center} stroke="#30363D" strokeWidth="1" strokeDasharray="5 5" />
            <line x1={center} y1={-2000} x2={center} y2={2000} stroke="#30363D" strokeWidth="1" strokeDasharray="5 5" />
            
            {elements.map((el, i) => {
              if (el.label && !visibleItems[el.label]) return null;
              
              const x = center + el.x * scale;
              const y = center - el.y * scale;

              if (el.type === 'circle') {
                return <circle key={i} cx={center} cy={center} r={el.r * scale} fill="none" stroke="#444" strokeWidth="1.2" strokeDasharray="4 4" />;
              }
              if (el.type === 'point') {
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="6" fill={el.color || '#5865F2'} />
                    <text x={x+10} y={y-10} fill="#000" fontSize="14" stroke="#000" strokeWidth="3" fontWeight="bold">{el.label}</text>
                    <text x={x+10} y={y-10} fill="#fff" fontSize="14" fontWeight="bold">{el.label}</text>
                  </g>
                );
              }
              if (el.type === 'vector' || el.type === 'versor') {
                const isVersor = el.type === 'versor';
                const vSize = isVersor ? 40 : scale * (el.len || 0.6);
                const vx = el.vx * vSize;
                const vy = el.vy * vSize;
                const color = el.color || (isVersor ? '#9BA8FF' : '#4ADE80');
                const tx = x + vx + (vx >= 0 ? 8 : -22);
                const ty = y - vy + (vy >= 0 ? -8 : 15);

                return (
                  <g key={i} className="vector-group">
                    <defs>
                      {/* Puntas de flecha más finas y estilizadas */}
                      <marker id={`arrow-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L5,3 z" fill={color} />
                      </marker>
                    </defs>
                    <line x1={x} y1={y} x2={x + vx} y2={y - vy} stroke={color} strokeWidth={isVersor ? 1.5 : 2.5} markerEnd={`url(#arrow-${i})`} />
                    <text x={tx} y={ty} fill="#000" fontSize={isVersor ? 11 : 14} stroke="#000" strokeWidth="3" fontWeight="bold">{el.label}</text>
                    <text x={tx} y={ty} fill={color} fontSize={isVersor ? 11 : 14} fontWeight="bold">{el.label}</text>
                  </g>
                );
              }
              return null;
            })}
          </g>
        </svg>
      </div>
      <p className="vector-hint">💡 Rueda: Zoom | Arrastrar: Mover</p>
    </div>
  );
};

// --- COMPONENTE DE GRÁFICO ---
const PhysicsChart = ({ title, xAxis, yAxis, series }) => {
  const processedSeries = series.map(s => ({
    ...s,
    data: s.data.map(p => ({
      x: typeof p.x === 'string' ? parseFloat(p.x.replace(/[^\d.-]/g, '')) : p.x,
      y: typeof p.y === 'string' ? parseFloat(p.y.replace(/[^\d.-]/g, '')) : p.y
    }))
  }));
  const timePoints = Array.from(new Set(processedSeries.flatMap(s => s.data.map(p => p.x)))).sort((a, b) => a - b);
  const combinedData = timePoints.map(x => {
    const point = { x };
    processedSeries.forEach(s => {
      const match = s.data.find(p => p.x === x);
      if (match) point[s.name] = match.y;
    });
    return point;
  });

  return (
    <div className="chart-container">
      <p className="chart-title">{title}</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={combinedData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
          <XAxis dataKey="x" type="number" domain={['auto', 'auto']} stroke="#8B949E" fontSize={11} label={{ value: xAxis, position: 'insideBottom', offset: -10 }} />
          <YAxis stroke="#8B949E" fontSize={11} domain={['auto', 'auto']} label={{ value: yAxis, angle: -90, position: 'insideLeft', offset: 15 }} />
          <Tooltip contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '8px' }} />
          <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px' }} />
          {processedSeries.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={true} animationDuration={800} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hola 👋 Soy tu asistente de Física Avanzado. Puedo analizar movimientos circulares, diagramas vectoriales y versores. ¡Subí tu ejercicio!',
      sources: [],
    }
  ])
  const [inputValue, setInputValue]   = useState('')
  const [loading, setLoading]         = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [docsInfo, setDocsInfo]       = useState({ documents: [], indexed: [], pending: [] })
  const chatBottomRef                 = useRef(null)
  const fileInputRef                  = useRef(null)

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  const fetchDocs = async () => { try { const res = await fetch(`${API_URL}/documents`); const data = await res.json(); setDocsInfo(data); } catch { } }
  useEffect(() => { fetchDocs() }, [])

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  }

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && !imagePreview || loading) return;
    const base64Image = imagePreview ? imagePreview.split(',')[1] : null;
    setMessages(prev => [...prev, { role: 'user', content: text || "Analizá esto.", image: imagePreview }]);
    setInputValue(''); setImagePreview(null); setLoading(true);

    try {
      const res  = await fetch(`${API_URL}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text || "Analizá esta imagen.", image: base64Image }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, sources: data.sources || [], charts: data.charts || [], diagrams: data.diagrams || [] }]);
    } catch { 
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error de conexión`, sources: [] }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-left"><span className="logo">⚛️</span><div><h1>Agente Física PRO</h1><p className="subtitle">Coordenadas Polares & Intrínsecas</p></div></div>
        <button className="ingest-btn" onClick={fetchDocs}>🔄 Sincronizar</button>
      </div>

      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.image && <img src={msg.image} className="message-image" alt="user upload" />}
            <div className="message-content">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.content}</ReactMarkdown>
            </div>
            {msg.diagrams?.map((d, i) => <VectorDiagram key={i} {...d} />)}
            {msg.charts?.map((c, i) => <PhysicsChart key={i} {...c} />)}
            {msg.sources?.length > 0 && (
              <details className="sources-details">
                <summary>📎 Referencias</summary>
                <div className="sources-list">
                  {msg.sources.map((s, i) => <div key={i} className="source-item"><strong>{s.source} (p {+s.page+1})</strong><span>{s.snippet}...</span></div>)}
                </div>
              </details>
            )}
          </div>
        ))}
        {loading && <div className="message assistant loading-msg"><div className="dot" /><div className="dot" /><div className="dot" /></div>}
        <div ref={chatBottomRef} />
      </div>

      <div className="input-wrapper">
        {imagePreview && <div className="image-preview-bar"><div className="preview-thumb"><img src={imagePreview} /><button className="remove-img" onClick={() => setImagePreview(null)}>X</button></div></div>}
        <div className="input-area">
          <input type="file" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} accept="image/*" />
          <button className="icon-btn" onClick={() => fileInputRef.current.click()}><Paperclip size={20} /></button>
          <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Enviá tu ejercicio polares/intrínsecas..." />
          <button className="send-btn" onClick={handleSend} disabled={loading}><Send size={18} /></button>
        </div>
      </div>
    </div>
  )
}

export default App
