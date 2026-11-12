"""Data models for analysis results."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Finding(BaseModel):
    severity: Severity
    category: str
    issue: str
    details: str | None = None
    pattern: str | None = None


class LiquidityInfo(BaseModel):
    has_liquidity: bool = False
    pair_address: str | None = None
    total_lp_tokens: int = 0
    burned_percentage: float = 0.0
    is_lp_locked: bool = False
    reserve_usd_estimate: float | None = None


class TokenMeta(BaseModel):
    name: str | None = None
    symbol: str | None = None
    decimals: int | None = None
    total_supply: str | None = None
    owner: str | None = None
    owner_is_contract: bool | None = None
    ownership_renounced: bool | None = None
    is_proxy: bool = False
    implementation: str | None = None


class SimulationResult(BaseModel):
    can_read: bool = False
    decimals: int | None = None
    suspicious_opcodes: list[str] = Field(default_factory=list)
    error: str | None = None


class RiskReport(BaseModel):
    contract_address: str
    chain: str
    overall_risk: RiskLevel
    score: int = Field(ge=0, le=100)
    findings: list[Finding] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    token: TokenMeta | None = None
    liquidity: LiquidityInfo | None = None
    simulation: SimulationResult | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
