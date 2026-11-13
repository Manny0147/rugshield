/**
 * RugShield multi-chain registry
 * RPC uses Alchemy where available; falls back to public endpoints.
 */

export type ChainId =
  | "ethereum"
  | "base"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "bsc"
  | "avalanche"
  | "blast"
  | "scroll"
  | "linea"
  | "zksync";

export interface ChainConfig {
  id: ChainId;
  name: string;
  chainId: number;
  nativeSymbol: string;
  wrappedNative: string;
  /** Uniswap V2-style factory (or closest equivalent) */
  factoryV2: string;
  /** Uniswap V2-style router */
  routerV2: string;
  /** Alchemy network slug (null = public RPC only) */
  alchemyNetwork: string | null;
  /** Public RPC fallback */
  publicRpc: string;
  explorer: string;
  /** Whether V2 getAmountsOut simulation is reliable */
  supportsV2Sim: boolean;
}

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY || "alch_qpK0fT8P9bvtEdNKUCbym";

export const CHAINS: Record<ChainId, ChainConfig> = {
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    nativeSymbol: "ETH",
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    factoryV2: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    routerV2: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    alchemyNetwork: "eth-mainnet",
    publicRpc: "https://ethereum.publicnode.com",
    explorer: "https://etherscan.io",
    supportsV2Sim: true,
  },
  base: {
    id: "base",
    name: "Base",
    chainId: 8453,
    nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    factoryV2: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", // Uniswap V2 on Base
    routerV2: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    alchemyNetwork: "base-mainnet",
    publicRpc: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    supportsV2Sim: true,
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum One",
    chainId: 42161,
    nativeSymbol: "ETH",
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    factoryV2: "0xf1D7CC64Fb4452F05c49812662A7d1106ac13380", // Sushi/Camelot-compatible
    routerV2: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506", // Sushi
    alchemyNetwork: "arb-mainnet",
    publicRpc: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    supportsV2Sim: true,
  },
  optimism: {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    nativeSymbol: "ETH",
    wrappedNative: "0x4200000000000000000000000000000000000006",
    factoryV2: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf",
    routerV2: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
    alchemyNetwork: "opt-mainnet",
    publicRpc: "https://mainnet.optimism.io",
    explorer: "https://optimistic.etherscan.io",
    supportsV2Sim: true,
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    nativeSymbol: "MATIC",
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    factoryV2: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32", // QuickSwap
    routerV2: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    alchemyNetwork: "polygon-mainnet",
    publicRpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    supportsV2Sim: true,
  },
  bsc: {
    id: "bsc",
    name: "BNB Chain",
    chainId: 56,
    nativeSymbol: "BNB",
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    factoryV2: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", // PancakeSwap V2
    routerV2: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    alchemyNetwork: null,
    publicRpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    supportsV2Sim: true,
  },
  avalanche: {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    nativeSymbol: "AVAX",
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    factoryV2: "0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10", // Trader Joe
    routerV2: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
    alchemyNetwork: "avax-mainnet",
    publicRpc: "https://api.avax.network/ext/bc/C/rpc",
    explorer: "https://snowtrace.io",
    supportsV2Sim: true,
  },
  blast: {
    id: "blast",
    name: "Blast",
    chainId: 81457,
    nativeSymbol: "ETH",
    wrappedNative: "0x4300000000000000000000000000000000000004",
    factoryV2: "0x5C346464d33F90bA6c859F1d4d6D708666330a99",
    routerV2: "0xBBDe1476F9Bf5E067bC445675da6a462124edA7f",
    alchemyNetwork: "blast-mainnet",
    publicRpc: "https://rpc.blast.io",
    explorer: "https://blastscan.io",
    supportsV2Sim: true,
  },
  scroll: {
    id: "scroll",
    name: "Scroll",
    chainId: 534352,
    nativeSymbol: "ETH",
    wrappedNative: "0x5300000000000000000000000000000000000004",
    factoryV2: "0xBCDC303D45f695d660a85F50C2ABc5E44e274803",
    routerV2: "0x17AFD0263D6909Ba1F9a8EAC697f765323650244",
    alchemyNetwork: null,
    publicRpc: "https://rpc.scroll.io",
    explorer: "https://scrollscan.com",
    supportsV2Sim: true,
  },
  linea: {
    id: "linea",
    name: "Linea",
    chainId: 59144,
    nativeSymbol: "ETH",
    wrappedNative: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    factoryV2: "0xBc5F3b5Bf5aCa0F6C7C4C8C8C8C8C8C8C8C8C8C8", // placeholder – use public
    routerV2: "0x0000000000000000000000000000000000000000",
    alchemyNetwork: "linea-mainnet",
    publicRpc: "https://rpc.linea.build",
    explorer: "https://lineascan.build",
    supportsV2Sim: false,
  },
  zksync: {
    id: "zksync",
    name: "zkSync Era",
    chainId: 324,
    nativeSymbol: "ETH",
    wrappedNative: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    factoryV2: "0x0000000000000000000000000000000000000000",
    routerV2: "0x0000000000000000000000000000000000000000",
    alchemyNetwork: null,
    publicRpc: "https://mainnet.era.zksync.io",
    explorer: "https://explorer.zksync.io",
    supportsV2Sim: false,
  },
};

export function getRpcUrl(chain: ChainId): string {
  const c = CHAINS[chain];
  if (!c) return CHAINS.ethereum.publicRpc;
  if (c.alchemyNetwork && ALCHEMY_KEY) {
    return `https://${c.alchemyNetwork}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  }
  return c.publicRpc;
}

export function resolveChain(input?: string): ChainConfig {
  const key = (input || "ethereum").toLowerCase() as ChainId;
  return CHAINS[key] || CHAINS.ethereum;
}

export const SUPPORTED_CHAINS = Object.values(CHAINS);
