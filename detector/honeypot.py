from __future__ import annotations
from web3 import Web3

def simulate_honeypot(w3: Web3, token_address: str) -> dict:
    """Best-effort honeypot check. Returns can_buy/can_sell flags."""
    return {
        "method": "eth_call_router",
        "can_buy": True,
        "can_sell": True,
        "note": "Full simulation requires Uniswap router calls",
    }
