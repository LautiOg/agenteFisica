# Agente de Física — RAG con Gemini

Asistente de IA que responde preguntas **solo** con el material de PDFs que vos copiás al proyecto.

**Stack:** React (Vite) · FastAPI · LangChain · ChromaDB · Google Gemini

---

## 🚀 Setup (una sola vez)

### 1. Configurar la API Key de Gemini
Editá `backend-python/.env`:
```
GOOGLE_API_KEY="tu-clave-de-ai.google.dev"
```
Conseguí tu clave gratis en: https://aistudio.google.com/app/apikey

### 2. Copiar los PDFs al proyecto
Poné tus archivos PDF de física en:
```
AgenteFisica/
└── backend-python/
    └── docs/        ← Copiá acá tus PDFs
```
**No hace falta volver a hacerlo.** Los PDFs se indexan una sola vez y se recuerdan.

---

## ▶️ Uso diario

### Levantar el Backend
Desde la carpeta `AgenteFisica/`:
```powershell
.\venv\Scripts\python.exe -m uvicorn backend-python.main:app --reload --port 8000
```
> Al arrancar, el servidor detecta automáticamente si hay PDFs nuevos y los indexa.

### Levantar el Frontend
En otra terminal, desde `AgenteFisica/frontend-react/`:
```powershell
npm run dev
```

Abrí **http://localhost:5173** y empezá a preguntar.

---

## ➕ Agregar nuevos PDFs sin reiniciar

1. Copiá el PDF nuevo a `backend-python/docs/`
2. En la UI, hacé clic en **"🔄 Indexar nuevo(s)"**  
   (el botón se pone naranja automáticamente cuando detecta archivos sin indexar)
3. ¡Listo! El agente ya tiene acceso al nuevo material.
