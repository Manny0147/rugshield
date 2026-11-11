"""Known function selectors, ABIs, and addresses."""

SIGNATURES: dict[str, str] = {
    "0x8da5cb5b": "owner()",
    "0xf2fde38b": "transferOwnership(address)",
    "0x715018a6": "renounceOwnership()",
    "0x40c10f19": "mint(address,uint256)",
    "0x42966c68": "burn(uint256)",
    "0xa9059cbb": "transfer(address,uint256)",
    "0x23b872dd": "transferFrom(address,address,uint256)",
    "0x095ea7b3": "approve(address,uint256)",
    "0x70a08231": "balanceOf(address)",
    "0x18160ddd": "totalSupply()",
    "0xdd62ed3e": "allowance(address,address)",
    "0x06fdde03": "name()",
    "0x95d89b41": "symbol()",
    "0x313ce567": "decimals()",
}

EIP1967_IMPLEMENTATION_SLOT = "360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

PUBLIC_RPCS = {
    "ethereum": [
        "https://eth-mainnet.g.alchemy.com/v2/alch_qpK0fT8P9bvtEdNKUCbym",
        "https://rpc.ankr.com/eth",
        "https://ethereum.publicnode.com",
        "https://eth.llamarpc.com",
    ],
    "bsc": [
        "https://bsc-dataseed.binance.org/",
        "https://rpc.ankr.com/bsc",
    ],
}

RENOUNCED_OWNERS = {
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
}

WRAPPED_NATIVE = {
    "ethereum": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "bsc": "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
}
