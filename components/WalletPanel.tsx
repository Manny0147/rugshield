"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { useEffect, useState } from "react";

const KNOWN_TOKENS = [
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const, decimals: 6 },
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const, decimals: 6 },
  { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const, decimals: 18 },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const, decimals: 18 },
  { symbol: "UNI", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" as const, decimals: 18 },
  { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" as const, decimals: 18 },
  { symbol: "AAVE", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" as const, decimals: 18 },
  { symbol: "MKR", address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" as const, decimals: 18 },
  { symbol: "SNX", address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F" as const, decimals: 18 },
  { symbol: "CRV", address: "0xD533a949740bb3306d119CC777fa900bA034cd52" as const, decimals: 18 },
  { symbol: "LDO", address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32" as const, decimals: 18 },
  { symbol: "RPL", address: "0xD33526068D116cE69F19A9ee46F0bd304F21A51f" as const, decimals: 18 },
  { symbol: "COMP", address: "0xc00e94Cb662C3520282E6f5717214004A7f26888" as const, decimals: 18 },
  { symbol: "YFI", address: "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e" as const, decimals: 18 },
  { symbol: "SUSHI", address: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2" as const, decimals: 18 },
  { symbol: "BAL", address: "0xba100000625a3754423978a60c9317c58a424e3D" as const, decimals: 18 },
  { symbol: "1INCH", address: "0x111111111117dC0aa78b770fA6A738034120C302" as const, decimals: 18 },
  { symbol: "GRT", address: "0xc944E90C64B2c07662A292be6244BDf05Cda44a7" as const, decimals: 18 },
  { symbol: "ENS", address: "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72" as const, decimals: 18 },
  { symbol: "APE", address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381" as const, decimals: 18 },
  { symbol: "SHIB", address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE" as const, decimals: 18 },
  { symbol: "PEPE", address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933" as const, decimals: 18 },
  { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as const, decimals: 8 },
];

type Holding = { symbol: string; address: string; balance: number; decimals: number };

export function WalletPanel({ onSelectToken }: { onSelectToken: (address: string) => void }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });
  const [extraHoldings, setExtraHoldings] = useState<Holding[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  const { data: tokenBalances } = useReadContracts({
    contracts: KNOWN_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!],
    })),
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (!address) return;
    setLoadingExtra(true);
    fetch(`/api/holdings?address=${address}`)
      .then((r) => r.json())
      .then((d) => setExtraHoldings(d.holdings || []))
      .catch(() => setExtraHoldings([]))
      .finally(() => setLoadingExtra(false));
  }, [address]);

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20"
      >
        Connect MetaMask
      </button>
    );
  }

  const onChain = KNOWN_TOKENS.map((t, i) => {
    const raw = tokenBalances?.[i]?.result as bigint | undefined;
    const formatted = raw ? Number(formatUnits(raw, t.decimals)) : 0;
    return { ...t, balance: formatted };
  }).filter((t) => t.balance > 0);

  const seen = new Set(onChain.map((t) => t.address.toLowerCase()));
  const merged = [...onChain, ...extraHoldings.filter((h) => !seen.has(h.address.toLowerCase()))];

  return (
    <div className="space-y-3 max-w-xs">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-mono text-xs text-zinc-400">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
          <div className="text-emerald-400">
            {ethBalance ? Number(ethBalance.formatted).toFixed(4) : "0"} ETH
          </div>
        </div>
        <button onClick={() => disconnect()} className="text-xs text-zinc-500 hover:text-zinc-300">
          Disconnect
        </button>
      </div>

      {merged.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Holdings {loadingExtra && "· loading…"}
          </p>
          {merged.map((t) => (
            <button
              key={t.address}
              onClick={() => onSelectToken(t.address)}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10"
            >
              <span className="font-semibold">{t.symbol}</span>
              <span className="font-mono text-xs text-zinc-400">{t.balance.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
