# ⚛️ Agente Física Pro - Despliegue

Este proyecto está listo para ser hosteado en **Render (Backend)** y **Vercel (Frontend)**.

## 🚀 Instrucciones de Despliegue

### 1. Backend (en Render.com)
1. Crea un **"Web Service"** apuntando a tu repo.
2. Root Directory: `backend-python`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables:**
   - `GOOGLE_API_KEY`: Tu llave (o varias separadas por coma).
   - `PYTHON_VERSION`: `3.10.0` (o superior).

### 2. Frontend (en Vercel.com)
1. Crea un nuevo proyecto apuntando a tu repo.
2. Framework Preset: `Vite`.
3. Root Directory: `frontend-react`
4. **Environment Variables:**
   - `VITE_API_URL`: La URL que te dio Render (ej: `https://tu-backend.onrender.com`).

---
Desarrollado con ❤️ para Estudiantes de Física.
