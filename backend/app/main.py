"""FastAPI application for RugShield."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Docker: /app/app/main.py + /app/detector
# Local:  backend/app/main.py + detector/
_HERE = Path(__file__).resolve().parent
for candidate in (_HERE.parent, _HERE.parent.parent, _HERE.parent.parent.parent):
    if (candidate / "detector").is_dir():
        sys.path.insert(0, str(candidate))
        break

from detector.detector import RugPullDetector
from detector.honeypot import simulate_honeypot
from detector.models import RiskReport

app = FastAPI(title="RugShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    address: str
    chain: str = "ethereum"
    rpc_url: str | None = None


class AnalyzeResponse(BaseModel):
    report: RiskReport
    honeypot: dict | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "rugshield"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    if not req.address or not req.address.startswith("0x") or len(req.address) != 42:
        raise HTTPException(status_code=400, detail="Invalid contract address")
    try:
        detector = RugPullDetector(rpc_url=req.rpc_url, chain=req.chain)
        report = await detector.analyze_contract(req.address)
        honeypot = None
        try:
            loop = asyncio.get_event_loop()
            honeypot = await loop.run_in_executor(
                None, simulate_honeypot, detector.w3, req.address
            )
        except Exception as e:
            honeypot = {"error": str(e)[:200]}
        return AnalyzeResponse(report=report, honeypot=honeypot)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)[:300]}")


@app.get("/analyze")
async def analyze_get(
    address: str = Query(...),
    chain: str = Query("ethereum"),
):
    return await analyze(AnalyzeRequest(address=address, chain=chain))
