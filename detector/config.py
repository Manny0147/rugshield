"""Configuration management via environment variables."""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    eth_rpc_url: str = "https://eth-mainnet.g.alchemy.com/v2/alch_qpK0fT8P9bvtEdNKUCbym"
    bsc_rpc_url: str = "https://bsc-dataseed.binance.org/"
    etherscan_api_key: str = ""
    bscscan_api_key: str = ""

    # Analysis defaults
    holder_lookback_blocks: int = 15_000
    concentration_critical_threshold: float = 80.0
    concentration_high_threshold: float = 50.0
    lp_lock_threshold: float = 95.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
