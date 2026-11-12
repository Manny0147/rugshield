import { NextRequest, NextResponse } from "next/server";

const ALCHEMY =
  process.env.ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
    : "https://eth-mainnet.g.alchemy.com/v2/alch_qpK0fT8P9bvtEdNKUCbym";

const UNISWAP_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const ZERO = "0x0000000000000000000000000000000000000000";
const DEAD = "0x000000000000000000000000000000000000dEaD";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(ALCHEMY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

function padAddress(addr: string) {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function decodeString(hex: string): string | undefined {
  if (!hex || hex === "0x") return undefined;
  try {
    const data = hex.slice(2);
    // dynamic string: offset + length + bytes
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = (body.address || "").trim();
    const chain = body.chain || "ethereum";

    if (!address.startsWith("0x") || address.length !== 42) {
      return NextResponse.json({ detail: "Invalid contract address" }, { status: 400 });
    }

    const findings: { severity: string; category: string; issue: string; details?: string }[] = [];
    let score = 0;

    // bytecode
    const code = await rpc("eth_getCode", [address, "latest"]);
    if (!code || code === "0x" || code === "0x0") {
      findings.push({
        severity: "HIGH",
        category: "Contract",
        issue: "No contract code at address",
        details: "Address is EOA or empty",
      });
      score += 40;
    }

    // name / symbol / decimals / owner via eth_call
    const [nameHex, symbolHex, decimalsHex, ownerHex] = await Promise.all([
      rpc("eth_call", [{ to: address, data: "0x06fdde03" }, "latest"]).catch(() => "0x"),
      rpc("eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]).catch(() => "0x"),
      rpc("eth_call", [{ to: address, data: "0x313ce567" }, "latest"]).catch(() => "0x"),
      rpc("eth_call", [{ to: address, data: "0x8da5cb5b" }, "latest"]).catch(() => "0x"),
    ]);

    const name = decodeString(nameHex);
    const symbol = decodeString(symbolHex);
    const decimals = decodeUint(decimalsHex);
    const owner = decodeAddress(ownerHex);
    const renounced =
      owner &&
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

    // Uniswap V2 pair
    let hasLiquidity = false;
    let pairAddress: string | undefined;
    let burnedPct = 0;
    let isLpLocked = false;

    try {
      const getPairData =
        "0xe6a43905" +
        padAddress(address) +
        padAddress(WETH);
      const pairHex = await rpc("eth_call", [
        { to: UNISWAP_FACTORY, data: getPairData },
        "latest",
      ]);
      pairAddress = decodeAddress(pairHex);
      if (pairAddress && pairAddress.toLowerCase() !== ZERO.toLowerCase()) {
        hasLiquidity = true;
        const totalHex = await rpc("eth_call", [
          { to: pairAddress, data: "0x18160ddd" },
          "latest",
        ]);
        const deadBalHex = await rpc("eth_call", [
          { to: pairAddress, data: "0x70a08231" + padAddress(DEAD) },
          "latest",
        ]);
        const zeroBalHex = await rpc("eth_call", [
          { to: pairAddress, data: "0x70a08231" + padAddress(ZERO) },
          "latest",
        ]);
        const total = BigInt(totalHex || "0x0");
        const burned = BigInt(deadBalHex || "0x0") + BigInt(zeroBalHex || "0x0");
        if (total > 0n) {
          burnedPct = Number((burned * 10000n) / total) / 100;
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
          issue: "No Uniswap V2 liquidity pair found",
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

    // Honeypot-ish: getAmountsOut buy + sell
    let honeypot: Record<string, unknown> = {
      method: "eth_call_router",
      can_buy: false,
      can_sell: false,
    };
    try {
      const amountIn = "0x" + (10n ** 16n).toString(16); // 0.01 ETH
      // getAmountsOut(uint256,address[]) selector 0xd06ca61f
      const pathBuy =
        "0xd06ca61f" +
        amountIn.slice(2).padStart(64, "0") +
        "0000000000000000000000000000000000000000000000000000000000000040" +
        "0000000000000000000000000000000000000000000000000000000000000002" +
        padAddress(WETH) +
        padAddress(address);
      const outBuy = await rpc("eth_call", [{ to: ROUTER, data: pathBuy }, "latest"]);
      if (outBuy && outBuy !== "0x" && outBuy.length > 130) {
        honeypot.can_buy = true;
        // last amount is at the end of the dynamic array
        const tokensOut = "0x" + outBuy.slice(-64);
        const pathSell =
          "0xd06ca61f" +
          tokensOut.slice(2).padStart(64, "0") +
          "0000000000000000000000000000000000000000000000000000000000000040" +
          "0000000000000000000000000000000000000000000000000000000000000002" +
          padAddress(address) +
          padAddress(WETH);
        try {
          const outSell = await rpc("eth_call", [{ to: ROUTER, data: pathSell }, "latest"]);
          if (outSell && outSell !== "0x" && BigInt("0x" + outSell.slice(-64)) > 0n) {
            honeypot.can_sell = true;
          } else {
            honeypot.error = "Sell path returns zero";
            findings.push({
              severity: "CRITICAL",
              category: "Honeypot",
              issue: "Honeypot detected — can buy but cannot sell",
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

    score = Math.min(score, 100);
    const overall_risk =
      score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";

    const recommendations: string[] = [];
    if (overall_risk === "CRITICAL" || overall_risk === "HIGH") {
      recommendations.push(
        "Do not interact until ownership and liquidity are verified independently"
      );
    }
    if (!isLpLocked) recommendations.push("Confirm LP is locked on a trusted locker");
    if (owner && !renounced)
      recommendations.push("Verify owner wallet reputation and mint authority");
    if (!recommendations.length)
      recommendations.push("Review ownership and liquidity before interacting");

    return NextResponse.json({
      report: {
        contract_address: address,
        chain,
        overall_risk,
        score,
        findings,
        recommendations,
        token: {
          name: name || "Unknown",
          symbol: symbol || "?",
          decimals,
          owner,
          ownership_renounced: renounced ?? null,
        },
        liquidity: {
          has_liquidity: hasLiquidity,
          burned_percentage: burnedPct,
          is_lp_locked: isLpLocked,
          pair_address: pairAddress,
        },
      },
      honeypot,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ detail: msg.slice(0, 300) }, { status: 500 });
  }
}
