"use client";

import { useState } from "react";
import { WalletPanel } from "@/components/WalletPanel";

// Prefer same-origin Next API (works on Vercel without Railway).
// Set NEXT_PUBLIC_API_URL only if you intentionally point at an external API.
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
};

const POPULAR_TOKENS = [
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", name: "Tether", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/325/small/Tether.png" },
  { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/2518/small/weth.png" },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg" },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", chain: "ethereum", logo: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png" },
];

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
            <h1 className="text-3xl font-bold">RugShield</h1>
            <p className="text-zinc-500 text-sm">Token risk & honeypot scanner</p>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${selectedToken === t.symbol ? "border-violet-500 bg-violet-500/20" : "border-white/10 bg-white/5"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.logo} alt={t.symbol} className="w-8 h-8 rounded-full" />
              <span className="text-sm font-semibold">{t.symbol}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm"
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
          />
          <select
            className="bg-black/40 border border-white/10 rounded-xl px-4 py-3"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
          >
            <option value="ethereum">Ethereum</option>
            <option value="bsc">BNB Chain</option>
          </select>
          <button
            onClick={analyze}
            disabled={loading}
            className="bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Analyze"}
          </button>
        </div>

        {error && <div className="text-red-400 mb-4">{error}</div>}

        {report && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="text-xl font-bold">
                  {report.token?.name || "Unknown"}{" "}
                  {report.token?.symbol && `(${report.token.symbol})`}
                </div>
                <div className="font-mono text-xs text-zinc-500 mt-1 break-all">
                  {report.contract_address}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{report.overall_risk}</div>
                <div className="text-sm text-zinc-400">Score {report.score}</div>
              </div>
            </div>

            {report.token?.owner && (
              <div className="text-sm text-zinc-400">
                Owner: <span className="font-mono text-zinc-200">{report.token.owner}</span>{" "}
                {report.token.ownership_renounced ? "(renounced)" : "(active)"}
              </div>
            )}

            {report.liquidity && (
              <div className="text-sm text-zinc-400">
                Liquidity: {report.liquidity.has_liquidity ? "Yes" : "No"}
                {report.liquidity.has_liquidity && (
                  <>
                    {" · "}LP burn {report.liquidity.burned_percentage?.toFixed?.(1) ?? report.liquidity.burned_percentage}%
                    {report.liquidity.is_lp_locked ? " · locked" : " · unlocked"}
                  </>
                )}
              </div>
            )}

            {honeypot && (
              <div className="text-sm text-zinc-400">
                Honeypot check: buy={String(honeypot.can_buy)} sell={String(honeypot.can_sell)}
                {honeypot.error ? ` · ${String(honeypot.error)}` : ""}
              </div>
            )}

            {report.findings?.length > 0 && (
              <div className="space-y-2">
                {report.findings.map((f, i) => (
                  <div key={i} className="text-sm border border-white/5 rounded-lg px-3 py-2">
                    <span className="font-semibold text-amber-300">[{f.severity}]</span>{" "}
                    {f.category}: {f.issue}
                    {f.details && <div className="text-xs text-zinc-500 mt-1">{f.details}</div>}
                  </div>
                ))}
              </div>
            )}

            {report.recommendations?.length > 0 && (
              <ul className="text-sm text-zinc-400 list-disc pl-5 space-y-1">
                {report.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
