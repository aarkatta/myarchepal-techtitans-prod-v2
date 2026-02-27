"""
FastAPI entry point — Vercel Python serverless.

Local dev:  cd api && uvicorn index:app --reload --port 8000
Vercel:     api/index.py is auto-detected; vercel.json routes /api/* here.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import pdf, export, notify

app = FastAPI(title="ArchePal API", version="1.0.0")

# CORS — allow Vite dev server and production Vercel URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",   # Vite dev (this project)
        "http://localhost:5173",   # Vite dev (default)
        "http://localhost:4173",   # Vite preview
        "https://*.vercel.app",    # Vercel deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(notify.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
