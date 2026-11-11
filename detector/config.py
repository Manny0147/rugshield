"""Configuration management via environment variables."""

import os
from functools import lru_cache
from dataclasses import dataclass


DEFAULT_RPC = {
    "ethereum": "https://eth-mainnet.g.alchemy.com/v2/alch_qpK0fT8P9bvtEdNKUCbym",
    "bsc": "https://bsc-dataseed.binance.org/",
}


@dataclass
class Settings:
    eth_rpc_url: str = "https://eth-mainnet.g.alchemy.com/v2/alch_qpK0fT8P9bvtEdNKUCbym"
    bsc_rpc_url: str = "https://bsc-dataseed.binance.org/"
    etherscan_api_key: str = ""
    bscscan_api_key: str = ""
    holder_lookback_blocks: int = 15_000
    concentration_critical_threshold: float = 80.0
    concentration_high_threshold: float = 50.0
    lp_lock_threshold: float = 95.0

    def __post_init__(self):
        self.eth_rpc_url = os.getenv("ETH_RPC_URL", self.eth_rpc_url)
        self.bsc_rpc_url = os.getenv("BSC_RPC_URL", self.bsc_rpc_url)
        self.etherscan_api_key = os.getenv("ETHERSCAN_API_KEY", self.etherscan_api_key)
        self.bscscan_api_key = os.getenv("BSCSCAN_API_KEY", self.bscscan_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
