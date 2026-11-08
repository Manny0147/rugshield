from __future__ import annotations
from web3 import Web3
from .models import RiskReport, Finding, Severity
from .config import DEFAULT_RPC

class RugPullDetector:
    def __init__(self, rpc_url: str | None = None, chain: str = "ethereum"):
        self.chain = chain
        self.rpc_url = rpc_url or DEFAULT_RPC.get(chain, DEFAULT_RPC["ethereum"])
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))

    async def analyze_contract(self, address: str) -> RiskReport:
        address = Web3.to_checksum_address(address)
        code = self.w3.eth.get_code(address)
        findings = []
        score = 20
        if not code or code == b"0x":
            findings.append(Finding(severity=Severity.HIGH, category="Contract", issue="No contract code at address"))
            score = 80
        return RiskReport(
            contract_address=address,
            chain=self.chain,
            overall_risk="MEDIUM" if score >= 40 else "LOW",
            score=score,
            findings=findings,
            recommendations=["Review ownership and liquidity before interacting"],
            token={"name": "Unknown", "symbol": "?"},
            liquidity={"has_liquidity": False, "burned_percentage": 0, "is_lp_locked": False},
        )
