import os
import json
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.vectorstores import Chroma
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# ── Configuración ──────────────────────────────────────────────────────────────
DOCS_DIR      = os.path.join(os.path.dirname(__file__), "docs")
CHROMA_DIR    = os.path.join(os.path.dirname(__file__), "chroma_db")
INDEXED_FILE  = os.path.join(os.path.dirname(__file__), "indexed_files.json")

# Usamos el nombre exacto que nos reporto tu lista de modelos
LLM_MODEL = "gemini-flash-latest"

os.makedirs(DOCS_DIR,   exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

def _load_indexed() -> set:
    if os.path.exists(INDEXED_FILE):
        with open(INDEXED_FILE) as f:
            return set(json.load(f))
    return set()

def _save_indexed(indexed: set):
    with open(INDEXED_FILE, "w") as f:
        json.dump(list(indexed), f)

# Cargamos el modelo una sola vez al inicio para máxima velocidad
print("🧠 Cargando modelo de lenguaje local (HuggingFace)...")
EMBEDDINGS = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

def _get_embeddings():
    return EMBEDDINGS

def _get_vectorstore(embeddings):
    return Chroma(persist_directory=CHROMA_DIR, embedding_function=embeddings)

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

def _build_chain():
    embeddings  = _get_embeddings()
    vectorstore = _get_vectorstore(embeddings)
    # Aumentamos a 8 fragmentos para que tenga más contexto
    retriever   = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 8})

    # Volvemos a Gemini para el Chat (Gratis y sin límites de lectura ahora)
    llm = ChatGoogleGenerativeAI(
        model=LLM_MODEL,
        temperature=0.2, # Un poquito más de creatividad para razonar
        google_api_key=os.getenv("GOOGLE_API_KEY"),
    )

    prompt = PromptTemplate(
        template="""
Eres un profesor de física experto y analítico. Tu tarea es responder con claridad basándote en los fragmentos del material proporcionado.

REGLAS DE RAZONAMIENTO:
1. Analiza profundamente el CONTEXTO. Si la respuesta no está escrita de forma literal pero puede deducirse lógicamente (como derivar una fórmula de posición a partir de la velocidad), HACELO y explicá tu razonamiento.
2. Si realmente no hay forma de responder con el material, di amablemente: "Esa información no está en el material disponible."

REGLAS DE ESTILO (VISUAL PREMIUM):
1. USA LaTeX para TODAS las fórmulas matemáticas. 
   - Línea: $fases$
   - Bloque: $$fórmula\_compleja$$
2. Usa Markdown (negritas, listas) para que la explicación sea fácil de leer.
3. Menciona qué documentos estás consultando en tu explicación.

CONTEXTO DEL MATERIAL:
{context}

PREGUNTA DEL ESTUDIANTE:
{question}

RESPUESTA DEL PROFESOR (En Markdown + LaTeX):
""",
        input_variables=["context", "question"],
    )

    rag_chain_from_docs = (
        RunnablePassthrough.assign(context=(lambda x: format_docs(x["context"])))
        | prompt
        | llm
        | StrOutputParser()
    )

    rag_chain_with_source = RunnableParallel(
        {"context": retriever, "question": RunnablePassthrough()}
    ).assign(answer=rag_chain_from_docs)

    return rag_chain_with_source


from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

import time

def ingest_new_pdfs() -> dict:
    indexed   = _load_indexed()
    all_pdfs  = [f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf")]
    new_pdfs  = [f for f in all_pdfs if f not in indexed]

    if not new_pdfs:
        return {"new": 0, "total": len(all_pdfs), "files": []}

    embeddings = _get_embeddings()
    splitter   = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    processed  = []

    for filename in new_pdfs:
        try:
            print(f"📄 Procesando: {filename}...")
            path   = os.path.join(DOCS_DIR, filename)
            loader = PyPDFLoader(path)
            pages  = loader.load()
            chunks = splitter.split_documents(pages)

            print(f"✂️  {filename} dividido en {len(chunks)} fragmentos. Indexando en base de datos local...")

            try:
                Chroma.from_documents(
                    documents=chunks,
                    embedding=embeddings,
                    persist_directory=CHROMA_DIR,
                )
            except Exception as db_err:
                # AUTORREPARACIÓN: Si hay choque de dimensiones, borramos la DB y reintentamos una vez
                if "dimension" in str(db_err).lower():
                    print("⚠️ Choque de dimensiones detectado. Limpiando base de datos vieja...")
                    if os.path.exists(CHROMA_DIR):
                        shutil.rmtree(CHROMA_DIR)
                    os.makedirs(CHROMA_DIR, exist_ok=True)
                    # Reintentar una vez con la DB limpia
                    Chroma.from_documents(
                        documents=chunks,
                        embedding=embeddings,
                        persist_directory=CHROMA_DIR,
                    )
                else:
                    raise db_err

            indexed.add(filename)
            processed.append({"file": filename, "pages": len(pages), "chunks": len(chunks)})
            print(f"✅ ¡Éxito! {filename} indexado.")
            
            if len(new_pdfs) > 1:
                time.sleep(0.5) 

        except Exception as e:
            print(f"❌ Error crítico en {filename}: {e}")
            continue

    _save_indexed(indexed)
    return {"new": len(processed), "total": len(all_pdfs), "files": processed}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🔍 Revisando carpeta /docs por PDFs nuevos...")
    try:
        # Ejecutamos la indexación sin bloquear el inicio del servidor
        result = ingest_new_pdfs()
        if result["new"] > 0:
            print(f"📚 {result['new']} PDF(s) nuevos indexados.")
        else:
            print("✔ Sin PDFs nuevos. Base de datos al día.")
    except Exception as e:
        print(f"⚠️  Error durante el inicio: {e}")
        print("El servidor seguirá corriendo, pero intentá indexar manualmente desde la UI luego.")
    yield

app = FastAPI(title="Agente Física API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok"}

@app.get("/documents")
def list_documents():
    indexed  = _load_indexed()
    all_pdfs = [f for f in os.listdir(DOCS_DIR) if f.lower().endswith(".pdf")]
    return {
        "documents": all_pdfs,
        "indexed":   list(indexed),
        "pending":   [f for f in all_pdfs if f not in indexed],
        "count":     len(all_pdfs),
    }

@app.post("/ingest")
def trigger_ingest():
    try:
        result = ingest_new_pdfs()
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
def chat(request: ChatRequest):
    indexed = _load_indexed()
    if not indexed:
        raise HTTPException(
            status_code=400,
            detail="No hay material indexado. Copiá PDFs a backend-python/docs/ y reiniciá el servidor."
        )
    try:
        chain  = _build_chain()
        result = chain.invoke(request.message)
        sources = [
            {
                "page":    doc.metadata.get("page", "?"),
                "source":  os.path.basename(doc.metadata.get("source", "?")),
                "snippet": doc.page_content[:200],
            }
            for doc in result.get("context", [])
        ]
        return {"response": result["answer"], "sources": sources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
