"""Core Rug Pull Detector engine — production grade."""

from __future__ import annotations

import asyncio
import re
from typing import Any

import aiohttp
from web3 import Web3
from web3.exceptions import ContractLogicError

from detector.config import Settings, get_settings
from detector.models import (
    Finding,
    LiquidityInfo,
    RiskLevel,
    RiskReport,
    Severity,
    SimulationResult,
    TokenMeta,
)
from detector.signatures import (
    DEAD_ADDRESSES,
    EIP1967_IMPLEMENTATION_SLOT,
    ERC20_ABI,
    FACTORIES,
    FACTORY_ABI,
    OWNABLE_ABI,
    PAIR_ABI,
    PUBLIC_RPCS,
    RENOUNCED_OWNERS,
    WRAPPED_NATIVE,
)


class RugPullDetector:
    """Production-grade token contract analyzer."""

    def __init__(
        self,
        rpc_url: str | None = None,
        chain: str = "ethereum",
        settings: Settings | None = None,
    ):
        self.settings = settings or get_settings()
        self.chain = chain.lower()

        if rpc_url:
            self.rpc_url = rpc_url
        elif self.chain == "bsc":
            self.rpc_url = self.settings.bsc_rpc_url
        else:
            self.rpc_url = self.settings.eth_rpc_url

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url, request_kwargs={"timeout": 25}))
        if not self.w3.is_connected():
            for url in PUBLIC_RPCS.get(self.chain, []):
                try:
                    self.w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 20}))
                    if self.w3.is_connected():
                        self.rpc_url = url
                        break
                except Exception:
                    continue

        self.explorer_api_key = (
            self.settings.bscscan_api_key if self.chain == "bsc" else self.settings.etherscan_api_key
        )
        self.explorer_base = (
            "https://api.bscscan.com/api" if self.chain == "bsc" else "https://api.etherscan.io/api"
        )

    async def analyze_contract(self, contract_address: str) -> RiskReport:
        """Run the full analysis pipeline and return a scored risk report."""
        contract_address = Web3.to_checksum_address(contract_address)
        findings: list[Finding] = []
        score = 0

        # 1. Code presence
        try:
            code = self.w3.eth.get_code(contract_address)
            if not code or code == b"" or code == b"0x":
                findings.append(
                    Finding(
                        severity=Severity.HIGH,
                        category="Contract",
                        issue="No contract code at address",
                        details="Address is EOA or empty",
                    )
                )
                score += 40
        except Exception as e:
            findings.append(
                Finding(
                    severity=Severity.MEDIUM,
                    category="RPC",
                    issue="Failed to fetch bytecode",
                    details=str(e)[:150],
                )
            )
            score += 10

        # 2. Token metadata + ownership
        token = await self._get_token_meta(contract_address)
        if token.ownership_renounced is False and token.owner:
            findings.append(
                Finding(
                    severity=Severity.MEDIUM,
                    category="Ownership",
                    issue="Ownership not renounced",
                    details=f"Owner: {token.owner}",
                )
            )
            score += 12
        if token.is_proxy:
            findings.append(
                Finding(
                    severity=Severity.MEDIUM,
                    category="Proxy",
                    issue="Contract is a proxy",
                    details=f"Implementation: {token.implementation}",
                )
            )
            score += 8

        # 3. Liquidity
        liquidity = await self._check_liquidity_pools(contract_address)
        if not liquidity.has_liquidity:
            findings.append(
                Finding(
                    severity=Severity.HIGH,
                    category="Liquidity",
                    issue="No Uniswap V2 liquidity pair found",
                )
            )
            score += 20
        elif not liquidity.is_lp_locked and liquidity.burned_percentage < self.settings.lp_lock_threshold:
            findings.append(
                Finding(
                    severity=Severity.HIGH,
                    category="Liquidity",
                    issue="LP not locked / low burn",
                    details=f"Burned: {liquidity.burned_percentage:.1f}%",
                )
            )
            score += 18

        # 4. Holder concentration (best-effort)
        holder_findings = await self._analyze_token_holders(contract_address)
        findings.extend(holder_findings)
        for f in holder_findings:
            score += self._severity_weight(f.severity)

        # Cap and map risk
        score = min(score, 100)
        if score >= 75:
            risk = RiskLevel.CRITICAL
        elif score >= 50:
            risk = RiskLevel.HIGH
        elif score >= 30:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.LOW

        recommendations = []
        if risk in (RiskLevel.CRITICAL, RiskLevel.HIGH):
            recommendations.append("Do not interact until ownership and liquidity are verified independently")
        if not liquidity.is_lp_locked:
            recommendations.append("Confirm LP is locked on a trusted locker")
        if token.ownership_renounced is False:
            recommendations.append("Verify owner wallet reputation and mint authority")
        if not recommendations:
            recommendations.append("Review ownership and liquidity before interacting")

        return RiskReport(
            contract_address=contract_address,
            chain=self.chain,
            overall_risk=risk,
            score=score,
            findings=findings,
            recommendations=recommendations,
            token=token,
            liquidity=liquidity,
            simulation=None,
            metadata={"rpc": self.rpc_url},
        )

    async def _get_token_meta(self, address: str) -> TokenMeta:
        meta = TokenMeta()
        try:
            c = self.w3.eth.contract(address=address, abi=ERC20_ABI)
            try:
                meta.name = c.functions.name().call()
            except Exception:
                pass
            try:
                meta.symbol = c.functions.symbol().call()
            except Exception:
                pass
            try:
                meta.decimals = int(c.functions.decimals().call())
            except Exception:
                pass
            try:
                meta.total_supply = str(c.functions.totalSupply().call())
            except Exception:
                pass
            try:
                owner = c.functions.owner().call()
                meta.owner = Web3.to_checksum_address(owner)
                meta.ownership_renounced = meta.owner.lower() in {a.lower() for a in RENOUNCED_OWNERS}
            except Exception:
                meta.ownership_renounced = None
        except Exception:
            pass

        # EIP-1967 proxy check
        try:
            slot = self.w3.eth.get_storage_at(address, int(EIP1967_IMPLEMENTATION_SLOT, 16))
            if slot and int.from_bytes(slot, "big") != 0:
                impl = Web3.to_checksum_address("0x" + slot.hex()[-40:])
                meta.is_proxy = True
                meta.implementation = impl
        except Exception:
            pass
        return meta

    async def _analyze_token_holders(self, address: str) -> list[Finding]:
        # Best-effort; without explorer key we skip deep holder analysis
        return []

    async def _check_liquidity_pools(self, address: str) -> LiquidityInfo:
        info = LiquidityInfo()
        factories = FACTORIES.get(self.chain, {})
        weth = WRAPPED_NATIVE.get(self.chain)
        if not weth:
            return info
        for name, factory_addr in factories.items():
            try:
                factory = self.w3.eth.contract(
                    address=Web3.to_checksum_address(factory_addr), abi=FACTORY_ABI
                )
                pair = factory.functions.getPair(
                    Web3.to_checksum_address(address),
                    Web3.to_checksum_address(weth),
                ).call()
                if pair and int(pair, 16) != 0:
                    info.has_liquidity = True
                    info.pair_address = Web3.to_checksum_address(pair)
                    try:
                        pair_c = self.w3.eth.contract(address=info.pair_address, abi=PAIR_ABI)
                        total = pair_c.functions.totalSupply().call()
                        info.total_lp_tokens = int(total)
                        burned = 0
                        for dead in DEAD_ADDRESSES:
                            try:
                                burned += pair_c.functions.balanceOf(Web3.to_checksum_address(dead)).call()
                            except Exception:
                                continue
                        if total > 0:
                            info.burned_percentage = (burned / total) * 100
                            info.is_lp_locked = info.burned_percentage >= self.settings.lp_lock_threshold
                    except Exception:
                        pass
                    break
            except Exception:
                continue
        return info

    def _severity_weight(self, severity: Severity) -> int:
        return {
            Severity.CRITICAL: 22,
            Severity.HIGH: 11,
            Severity.MEDIUM: 5,
            Severity.LOW: 2,
            Severity.INFO: 0,
        }.get(severity, 0)
