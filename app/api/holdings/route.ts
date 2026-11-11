import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  if (!address || !address.startsWith("0x")) {
    return NextResponse.json({ holdings: [] });
  }

  const key = process.env.ALCHEMY_API_KEY;
  if (!key) {
    return NextResponse.json({ holdings: [], source: "none" });
  }

  try {
    const res = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getTokenBalances",
        params: [address, "erc20"],
      }),
    });
    const data = await res.json();
    const tokens = data?.result?.tokenBalances || [];

    const holdings = tokens
      .filter((t: any) => t.tokenBalance && t.tokenBalance !== "0x0")
      .slice(0, 40)
      .map((t: any) => ({
        address: t.contractAddress,
        symbol: "TOKEN",
        balance: 0,
        decimals: 18,
      }));

    return NextResponse.json({ holdings, source: "alchemy" });
  } catch {
    return NextResponse.json({ holdings: [], source: "error" });
  }
}
