"use client";

import { useState } from "react";
import { WalletPanel } from "@/components/WalletPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type Finding = {
  severity: string;
  category: string;
  issue: string;
  details?: string;
};

type Report = {
  contract_address: string;
  chain: string;
  chain_name?: string;
  overall_risk: string;
  score: number;
  findings: Finding[];
  recommendations: string[];
  token?: {
    name?: string;
    symbol?: string;
    decimals?: number;
    owner?: string;
    ownership_renounced?: boolean;
  };
  liquidity?: {
    has_liquidity: boolean;
    burned_percentage: number;
    is_lp_locked: boolean;
    pair_address?: string;
  };
  controls?: string[];
  explorer?: string;
};

const CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "optimism", label: "Optimism" },
  { id: "polygon", label: "Polygon" },
  { id: "bsc", label: "BNB Chain" },
  { id: "avalanche", label: "Avalanche" },
  { id: "blast", label: "Blast" },
  { id: "scroll", label: "Scroll" },
  { id: "linea", label: "Linea" },
  { id: "zksync", label: "zkSync Era" },
];

const POPULAR_TOKENS = [
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png" },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg" },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png" },
];

function riskColor(risk: string) {
  switch (risk) {
    case "CRITICAL": return "text-red-400";
    case "HIGH": return "text-orange-400";
    case "MEDIUM": return "text-amber-300";
    default: return "text-emerald-400";
  }
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [honeypot, setHoneypot] = useState<Record<string, unknown> | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  function selectToken(token: (typeof POPULAR_TOKENS)[0]) {
    setAddress(token.address);
    setChain(token.chain);
    setSelectedToken(token.symbol);
    setError(null);
  }

  async function analyze() {
    if (!address.startsWith("0x") || address.length !== 42) {
      setError("Enter a valid 42-character 0x address");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setHoneypot(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Analysis failed");
      }
      const data = await res.json();
      setReport(data.report);
      setHoneypot(data.honeypot || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              RugShield
            </h1>
            <p className="text-zinc-500 text-sm">Multi-chain token risk · honeypot · tax scanner</p>
          </div>
          <WalletPanel
            onSelectToken={(addr) => {
              setAddress(addr);
              setSelectedToken(null);
            }}
          />
        </header>

        <div className="flex gap-3 overflow-x-auto pb-4 mb-6">
          {POPULAR_TOKENS.map((t) => (
            <button
              key={t.symbol}
              onClick={() => selectToken(t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 ${
                selectedToken === t.symbol
                  ? "border-violet-500 bg-violet-500/20"
                  : "border-white/10 bg-white/5 hover:border-white/20"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo} alt={t.symbol} className="w-7 h-7 rounded-full" />
              <span className="text-sm font-semibold">{t.symbol}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none focus:border-violet-500"
            placeholder="0x... contract address"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value.trim());
              setSelectedToken(null);
            }}
          />
          <select
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            onClick={analyze}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition"
          >
            {loading ? "Scanning..." : "Analyze"}
          </button>
        </div>

        {error && (
          <div className="text-red-400 mb-4 text-sm border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {report && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-xl font-bold">
                  {report.token?.name || "Unknown"}{" "}
                  {report.token?.symbol && (
                    <span className="text-zinc-400">({report.token.symbol})</span>
                  )}
                </div>
                <div className="font-mono text-xs text-zinc-500 mt-1 break-all">
                  {report.contract_address}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {report.chain_name || report.chain}
                  {report.explorer && (
                    <>
                      {" · "}
                      <a
                        href={report.explorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        Explorer
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${riskColor(report.overall_risk)}`}>
                  {report.overall_risk}
                </div>
                <div className="text-sm text-zinc-400">Score {report.score}/100</div>
              </div>
            </div>

            {report.token?.owner && (
              <div className="text-sm text-zinc-400">
                Owner:{" "}
                <span className="font-mono text-zinc-200 text-xs">{report.token.owner}</span>{" "}
                {report.token.ownership_renounced ? (
                  <span className="text-emerald-400">(renounced)</span>
                ) : (
                  <span className="text-amber-300">(active)</span>
                )}
              </div>
            )}

            {report.liquidity && (
              <div className="text-sm text-zinc-400">
                Liquidity: {report.liquidity.has_liquidity ? "Yes" : "No"}
                {report.liquidity.has_liquidity && (
                  <>
                    {" · "}LP burn{" "}
                    {typeof report.liquidity.burned_percentage === "number"
                      ? report.liquidity.burned_percentage.toFixed(1)
                      : report.liquidity.burned_percentage}
                    %
                    {report.liquidity.is_lp_locked ? (
                      <span className="text-emerald-400"> · locked</span>
                    ) : (
                      <span className="text-amber-300"> · unlocked</span>
                    )}
                  </>
                )}
              </div>
            )}

            {honeypot && (
              <div className="text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-black/30 rounded-lg px-3 py-2">
                  <div className="text-xs text-zinc-500">Buy</div>
                  <div className={honeypot.can_buy ? "text-emerald-400" : "text-red-400"}>
                    {String(honeypot.can_buy)}
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg px-3 py-2">
                  <div className="text-xs text-zinc-500">Sell</div>
                  <div className={honeypot.can_sell ? "text-emerald-400" : "text-red-400"}>
                    {String(honeypot.can_sell)}
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg px-3 py-2">
                  <div className="text-xs text-zinc-500">Est. sell tax</div>
                  <div>
                    {honeypot.sell_tax_pct != null ? `${honeypot.sell_tax_pct}%` : "—"}
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg px-3 py-2">
                  <div className="text-xs text-zinc-500">Method</div>
                  <div className="text-xs truncate">{String(honeypot.method || "—")}</div>
                </div>
              </div>
            )}

            {report.controls && report.controls.length > 0 && (
              <div className="text-sm">
                <div className="text-zinc-500 mb-1">Detected controls</div>
                <div className="flex flex-wrap gap-1.5">
                  {report.controls.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {report.findings?.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-zinc-500">Findings</div>
                {report.findings.map((f, i) => (
                  <div key={i} className="text-sm border border-white/5 rounded-lg px-3 py-2 bg-black/20">
                    <span
                      className={`font-semibold ${
                        f.severity === "CRITICAL"
                          ? "text-red-400"
                          : f.severity === "HIGH"
                          ? "text-orange-400"
                          : "text-amber-300"
                      }`}
                    >
                      [{f.severity}]
                    </span>{" "}
                    <span className="text-zinc-300">{f.category}:</span> {f.issue}
                    {f.details && (
                      <div className="text-xs text-zinc-500 mt-1">{f.details}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {report.recommendations?.length > 0 && (
              <div>
                <div className="text-sm text-zinc-500 mb-1">Recommendations</div>
                <ul className="text-sm text-zinc-400 list-disc pl-5 space-y-1">
                  {report.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
