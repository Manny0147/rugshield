import { NextRequest, NextResponse } from "next/server";
import { resolveChain, type ChainId } from "@/lib/chains";

const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dEaD";

const DANGEROUS_SELECTORS: { sig: string; name: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" }[] = [
  { sig: "0x8456cb59", name: "pause()", severity: "HIGH" },
  { sig: "0x3f4ba83a", name: "unpause()", severity: "HIGH" },
  { sig: "0x40c10f19", name: "mint(address,uint256)", severity: "HIGH" },
  { sig: "0x061c82d0", name: "setTaxFee", severity: "HIGH" },
  { sig: "0x15aee635", name: "setFees", severity: "HIGH" },
  { sig: "0x8c0b5e22", name: "setSellFee", severity: "CRITICAL" },
  { sig: "0x7d1db4a5", name: "setMaxTxAmount", severity: "HIGH" },
  { sig: "0xec28438a", name: "setMaxTxPercent", severity: "HIGH" },
  { sig: "0x8f9a55c0", name: "setMaxWallet", severity: "HIGH" },
  { sig: "0xf9f92be4", name: "blacklist", severity: "CRITICAL" },
  { sig: "0x0ecb93c0", name: "addBot", severity: "CRITICAL" },
  { sig: "0x9cd441da", name: "setBlacklistEnabled", severity: "CRITICAL" },
  { sig: "0x8a8c523c", name: "enableTrading", severity: "HIGH" },
  { sig: "0x293230b8", name: "enableTrade", severity: "HIGH" },
];

async function rpc(rpcUrl: string, method: string, params: unknown[]) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result as string;
}

function padAddress(addr: string) {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function decodeString(hex: string): string | undefined {
  if (!hex || hex === "0x") return undefined;
  try {
    const data = hex.slice(2);
    if (data.length < 128) return undefined;
    const len = parseInt(data.slice(64, 128), 16);
    const strHex = data.slice(128, 128 + len * 2);
    let s = "";
    for (let i = 0; i < strHex.length; i += 2) {
      const c = parseInt(strHex.slice(i, i + 2), 16);
      if (c) s += String.fromCharCode(c);
    }
    return s || undefined;
  } catch {
    return undefined;
  }
}

function decodeUint(hex: string): number | undefined {
  if (!hex || hex === "0x") return undefined;
  try {
    return parseInt(hex, 16);
  } catch {
    return undefined;
  }
}

function decodeAddress(hex: string): string | undefined {
  if (!hex || hex === "0x" || hex.length < 66) return undefined;
  return "0x" + hex.slice(-40);
}

function hasSelector(code: string, sig: string): boolean {
  if (!code || code === "0x") return false;
  return code.toLowerCase().includes(sig.slice(2).toLowerCase());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body.address || "").trim();
    const chainInput = (body.chain || "ethereum") as ChainId;

    if (!address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json({ detail: "Invalid contract address" }, { status: 400 });
    }

    const chain = resolveChain(chainInput);
    const rpcUrl = chain.alchemyNetwork
      ? `https://${chain.alchemyNetwork}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || "alch_qpK0fT8P9bvtEdNKUCbym"}`
      : chain.publicRpc;

    const findings: { severity: string; category: string; issue: string; details?: string }[] = [];
    let score = 0;

    const code = await rpc(rpcUrl, "eth_getCode", [address, "latest"]);
    if (!code || code === "0x" || code === "0x0") {
      findings.push({
        severity: "HIGH",
        category: "Contract",
        issue: "No contract code at address",
        details: "Address is EOA or empty",
      });
      score += 40;
    }

    const [nameHex, symbolHex, decimalsHex, ownerHex] = await Promise.all([
      rpc(rpcUrl, "eth_call", [{ to: address, data: "0x06fdde03" }, "latest"]).catch(() => "0x"),
      rpc(rpcUrl, "eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]).catch(() => "0x"),
      rpc(rpcUrl, "eth_call", [{ to: address, data: "0x313ce567" }, "latest"]).catch(() => "0x"),
      rpc(rpcUrl, "eth_call", [{ to: address, data: "0x8da5cb5b" }, "latest"]).catch(() => "0x"),
    ]);

    const name = decodeString(nameHex);
    const symbol = decodeString(symbolHex);
    const decimals = decodeUint(decimalsHex);
    const owner = decodeAddress(ownerHex);
    const renounced =
      !!owner &&
      (owner.toLowerCase() === ZERO.toLowerCase() || owner.toLowerCase() === DEAD.toLowerCase());

    if (owner && !renounced) {
      findings.push({
        severity: "MEDIUM",
        category: "Ownership",
        issue: "Ownership not renounced",
        details: `Owner: ${owner}`,
      });
      score += 12;
    }

    const detectedControls: string[] = [];
    if (code && code !== "0x") {
      for (const d of DANGEROUS_SELECTORS) {
        if (hasSelector(code, d.sig)) {
          detectedControls.push(d.name);
          findings.push({
            severity: d.severity,
            category: "Transfer Restriction",
            issue: `Control function present: ${d.name}`,
            details: "Owner-controlled restriction or tax setter found in bytecode",
          });
          score += d.severity === "CRITICAL" ? 22 : d.severity === "HIGH" ? 10 : 4;
        }
      }
    }

    let hasLiquidity = false;
    let pairAddress: string | undefined;
    let burnedPct = 0;
    let isLpLocked = false;

    if (chain.supportsV2Sim && chain.factoryV2 !== ZERO) {
      try {
        const getPairData = "0xe6a43905" + padAddress(address) + padAddress(chain.wrappedNative);
        const pairHex = await rpc(rpcUrl, "eth_call", [
          { to: chain.factoryV2, data: getPairData },
          "latest",
        ]);
        pairAddress = decodeAddress(pairHex);
        if (pairAddress && pairAddress.toLowerCase() !== ZERO.toLowerCase()) {
          hasLiquidity = true;
          const totalHex = await rpc(rpcUrl, "eth_call", [{ to: pairAddress, data: "0x18160ddd" }, "latest"]);
          const deadBalHex = await rpc(rpcUrl, "eth_call", [
            { to: pairAddress, data: "0x70a08231" + padAddress(DEAD) },
            "latest",
          ]);
          const zeroBalHex = await rpc(rpcUrl, "eth_call", [
            { to: pairAddress, data: "0x70a08231" + padAddress(ZERO) },
            "latest",
          ]);
          const total = BigInt(totalHex || "0x0");
          const burned = BigInt(deadBalHex || "0x0") + BigInt(zeroBalHex || "0x0");
          if (total > BigInt(0)) {
            burnedPct = Number((burned * BigInt(10000)) / total) / 100;
            isLpLocked = burnedPct >= 95;
          }
          if (!isLpLocked) {
            findings.push({
              severity: "HIGH",
              category: "Liquidity",
              issue: "LP not locked / low burn",
              details: `Burned: ${burnedPct.toFixed(1)}%`,
            });
            score += 18;
          }
        } else {
          findings.push({
            severity: "HIGH",
            category: "Liquidity",
            issue: "No V2 liquidity pair found",
          });
          score += 20;
        }
      } catch {
        findings.push({
          severity: "MEDIUM",
          category: "Liquidity",
          issue: "Could not resolve liquidity pair",
        });
        score += 8;
      }
    }

    const honeypot: Record<string, unknown> = {
      method: "eth_call_router",
      chain: chain.id,
      can_buy: false,
      can_sell: false,
      buy_tax_pct: null as number | null,
      sell_tax_pct: null as number | null,
    };

    if (chain.supportsV2Sim && chain.routerV2 !== ZERO) {
      try {
        const amountIn = "0x" + BigInt("10000000000000000").toString(16);
        const pathBuy =
          "0xd06ca61f" +
          amountIn.slice(2).padStart(64, "0") +
          "0000000000000000000000000000000000000000000000000000000000000040" +
          "0000000000000000000000000000000000000000000000000000000000000002" +
          padAddress(chain.wrappedNative) +
          padAddress(address);

        const outBuy = await rpc(rpcUrl, "eth_call", [{ to: chain.routerV2, data: pathBuy }, "latest"]);

        if (outBuy && outBuy !== "0x" && outBuy.length > 130) {
          honeypot.can_buy = true;
          const tokensOutHex = "0x" + outBuy.slice(-64);
          const tokensOut = BigInt(tokensOutHex);

          const pathSell =
            "0xd06ca61f" +
            tokensOutHex.slice(2).padStart(64, "0") +
            "0000000000000000000000000000000000000000000000000000000000000040" +
            "0000000000000000000000000000000000000000000000000000000000000002" +
            padAddress(address) +
            padAddress(chain.wrappedNative);

          try {
            const outSell = await rpc(rpcUrl, "eth_call", [
              { to: chain.routerV2, data: pathSell },
              "latest",
            ]);

            if (outSell && outSell !== "0x" && outSell.length > 130) {
              const ethBack = BigInt("0x" + outSell.slice(-64));
              if (ethBack > BigInt(0)) {
                honeypot.can_sell = true;
                const amountInBn = BigInt("10000000000000000");
                const lossBps = Number(((amountInBn - ethBack) * BigInt(10000)) / amountInBn);
                const estimatedTaxBps = Math.max(0, lossBps - 60);
                const estimatedTaxPct = estimatedTaxBps / 100;
                honeypot.sell_tax_pct = Math.round(estimatedTaxPct * 10) / 10;

                if (estimatedTaxPct >= 40) {
                  findings.push({
                    severity: "CRITICAL",
                    category: "Tax",
                    issue: `Extremely high effective sell tax (~${estimatedTaxPct.toFixed(1)}%)`,
                    details: "Round-trip simulation indicates sell is effectively blocked by tax",
                  });
                  score += 35;
                } else if (estimatedTaxPct >= 15) {
                  findings.push({
                    severity: "HIGH",
                    category: "Tax",
                    issue: `High effective sell tax (~${estimatedTaxPct.toFixed(1)}%)`,
                  });
                  score += 15;
                } else if (estimatedTaxPct >= 8) {
                  findings.push({
                    severity: "MEDIUM",
                    category: "Tax",
                    issue: `Elevated sell tax (~${estimatedTaxPct.toFixed(1)}%)`,
                  });
                  score += 6;
                }
              } else {
                honeypot.error = "Sell path returns zero";
                findings.push({
                  severity: "CRITICAL",
                  category: "Honeypot",
                  issue: "Honeypot detected — can buy but cannot sell",
                });
                score += 40;
              }
            } else {
              honeypot.can_sell = false;
              honeypot.error = "Sell path returned empty";
              findings.push({
                severity: "CRITICAL",
                category: "Honeypot",
                issue: "Honeypot detected — sell path fails",
              });
              score += 40;
            }
          } catch (e: unknown) {
            honeypot.can_sell = false;
            honeypot.error = e instanceof Error ? e.message.slice(0, 120) : "sell failed";
            findings.push({
              severity: "CRITICAL",
              category: "Honeypot",
              issue: "Honeypot detected — sell path reverts",
              details: String(honeypot.error),
            });
            score += 40;
          }
        } else {
          honeypot.error = "No liquidity or zero output on buy path";
        }
      } catch (e: unknown) {
        honeypot.error = e instanceof Error ? e.message.slice(0, 120) : "simulation error";
      }
    } else {
      honeypot.error = `V2 simulation not supported on ${chain.name}`;
    }

    score = Math.min(score, 100);
    const overall_risk =
      score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";

    const recommendations: string[] = [];
    if (overall_risk === "CRITICAL" || overall_risk === "HIGH") {
      recommendations.push(
        "Do not interact until ownership, liquidity, and transfer logic are independently verified"
      );
    }
    if (!isLpLocked && hasLiquidity)
      recommendations.push("Confirm LP is locked on a trusted locker");
    if (owner && !renounced)
      recommendations.push("Verify owner wallet reputation, mint authority, and recent activity");
    if (detectedControls.length)
      recommendations.push(
        "Review transfer restriction / tax setter functions — owner can change rules post-launch"
      );
    if (honeypot.can_buy && !honeypot.can_sell)
      recommendations.push("CRITICAL: Token appears to be a honeypot — selling is blocked");
    if (!recommendations.length)
      recommendations.push("Review ownership and liquidity before interacting");

    return NextResponse.json({
      report: {
        contract_address: address,
        chain: chain.id,
        chain_name: chain.name,
        overall_risk,
        score,
        findings,
        recommendations,
        token: {
          name: name || "Unknown",
          symbol: symbol || "?",
          decimals,
          owner,
          ownership_renounced: renounced,
        },
        liquidity: {
          has_liquidity: hasLiquidity,
          burned_percentage: burnedPct,
          is_lp_locked: isLpLocked,
          pair_address: pairAddress,
        },
        controls: detectedControls,
        explorer: `${chain.explorer}/address/${address}`,
      },
      honeypot,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ detail: msg.slice(0, 300) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") || "";
  const chain = req.nextUrl.searchParams.get("chain") || "ethereum";
  const fakeReq = { json: async () => ({ address, chain }) } as NextRequest;
  return POST(fakeReq);
}
