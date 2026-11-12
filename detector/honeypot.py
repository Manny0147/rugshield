"""Honeypot simulation via eth_call against Uniswap V2 router.

This is the industry-standard approach used by most public scanners.
For higher fidelity in production, replace with an Anvil fork + real transactions.
"""

from __future__ import annotations

from web3 import Web3
from web3.exceptions import ContractLogicError

# Uniswap V2 Router02
UNISWAP_V2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
        ],
        "name": "getAmountsOut",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactETHForTokensSupportingFeeOnTransferTokens",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"},
        ],
        "name": "swapExactTokensForETHSupportingFeeOnTransferTokens",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def simulate_honeypot(
    w3: Web3,
    token_address: str,
    eth_amount_wei: int = 10**16,  # 0.01 ETH
) -> dict:
    """
    Simulate a small buy then sell using eth_call.
    Returns can_buy, can_sell, and estimated tax if detectable.
    """
    token_address = Web3.to_checksum_address(token_address)
    router = w3.eth.contract(address=UNISWAP_V2_ROUTER, abi=ROUTER_ABI)

    result = {
        "can_buy": False,
        "can_sell": False,
        "buy_tax_estimate": None,
        "sell_tax_estimate": None,
        "error": None,
        "method": "eth_call_router",
    }

    try:
        path_buy = [WETH, token_address]
        amounts_out = router.functions.getAmountsOut(eth_amount_wei, path_buy).call()
        if not amounts_out or amounts_out[-1] == 0:
            result["error"] = "No liquidity or zero output on buy path"
            return result
        result["can_buy"] = True
        expected_tokens = amounts_out[-1]

        path_sell = [token_address, WETH]
        try:
            sell_amounts = router.functions.getAmountsOut(expected_tokens, path_sell).call()
            if sell_amounts and sell_amounts[-1] > 0:
                result["can_sell"] = True
                eth_back = sell_amounts[-1]
                if eth_amount_wei > 0:
                    loss_pct = (1 - (eth_back / eth_amount_wei)) * 100
                    if loss_pct > 5:
                        result["sell_tax_estimate"] = round(loss_pct, 1)
            else:
                result["can_sell"] = False
                result["error"] = "Sell path returns zero"
        except ContractLogicError as e:
            result["can_sell"] = False
            result["error"] = f"Sell simulation reverted: {str(e)[:120]}"
        except Exception as e:
            result["can_sell"] = False
            result["error"] = f"Sell simulation failed: {str(e)[:120]}"

    except ContractLogicError as e:
        result["error"] = f"Buy path reverted: {str(e)[:120]}"
    except Exception as e:
        result["error"] = f"Simulation error: {str(e)[:120]}"

    return result
