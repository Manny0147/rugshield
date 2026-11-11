"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";

const KNOWN_TOKENS = [
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const, decimals: 6 },
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const, decimals: 6 },
  { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const, decimals: 18 },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as const, decimals: 18 },
  { symbol: "UNI", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" as const, decimals: 18 },
  { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" as const, decimals: 18 },
  { symbol: "AAVE", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" as const, decimals: 18 },
];

export function WalletPanel({ onSelectToken }: { onSelectToken: (address: string) => void }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });

  const { data: tokenBalances } = useReadContracts({
    contracts: KNOWN_TOKENS.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!],
    })),
    query: { enabled: !!address },
  });

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

  const holdings = KNOWN_TOKENS.map((t, i) => {
    const raw = tokenBalances?.[i]?.result as bigint | undefined;
    const formatted = raw ? Number(formatUnits(raw, t.decimals)) : 0;
    return { ...t, balance: formatted };
  }).filter((t) => t.balance > 0);

  return (
    <div className="space-y-3">
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

      {holdings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Holdings</p>
          {holdings.map((t) => (
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
