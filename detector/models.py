from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel

class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"

class Finding(BaseModel):
    severity: Severity
    category: str
    issue: str
    details: Optional[str] = None

class RiskReport(BaseModel):
    contract_address: str
    chain: str
    overall_risk: str
    score: int
    findings: list[Finding] = []
    recommendations: list[str] = []
    token: Optional[dict] = None
    liquidity: Optional[dict] = None
