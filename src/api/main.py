from fastapi import FastAPI

from src.api.routers import auth

app = FastAPI(
    title="VyapaarCart API",
    description="Multi-vendor e-commerce marketplace API",
    version="1.0.0",
)

app.include_router(auth.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
