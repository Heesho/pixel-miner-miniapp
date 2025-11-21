"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavBar } from "@/components/nav-bar";
import { AddToFarcasterButton } from "@/components/add-to-farcaster-button";
import { DuneDashboardButton } from "@/components/dune-dashboard-button";
import { CONTRACT_ADDRESSES, MULTICALL_ABI } from "@/lib/contracts";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type MinerState = {
  pps: bigint;
  pixelPrice: bigint;
  pixelBalance: bigint;
  ethBalance: bigint;
  wethBalance: bigint;
};

type SlotState = {
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  price: bigint;
  multiplier: bigint;
  pps: bigint;
  mined: bigint;
  miner: Address;
  color: string;
};

const DONUT_DECIMALS = 18;

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

const formatEth = (value: bigint, maximumFractionDigits = 4) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) {
    return formatEther(value);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

const formatTokenAmount = (
  value: bigint,
  decimals: number,
  maximumFractionDigits = 2,
) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) {
    return formatUnits(value, decimals);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

export default function AboutPage() {
  const readyRef = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { address } = useAccount();

  // Fetch miner state
  const { data: rawMinerState } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getMiner",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: {
      refetchInterval: 15_000,
    },
  });

  const minerState = useMemo(() => {
    if (!rawMinerState) return undefined;
    return rawMinerState as unknown as MinerState;
  }, [rawMinerState]);

  // Fetch all slots
  const { data: rawAllSlots } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getSlots",
    args: [BigInt(0), BigInt(255)],
    chainId: base.id,
    query: {
      refetchInterval: 20_000,
    },
  });

  const allSlots = useMemo(() => {
    if (!rawAllSlots) return [];
    return rawAllSlots as unknown as SlotState[];
  }, [rawAllSlots]);

  // Find owned slots
  const ownedSlotIndices = useMemo(() => {
    if (!address || !allSlots || allSlots.length === 0) return new Set<number>();
    const owned = new Set<number>();
    allSlots.forEach((slot, index) => {
      if (slot.miner.toLowerCase() === address.toLowerCase()) {
        owned.add(index);
      }
    });
    return owned;
  }, [address, allSlots]);

  // Get selected slot or first owned slot
  const slotState = useMemo(() => {
    if (!allSlots || allSlots.length === 0) return undefined;
    // If user owns slots, show the first owned slot, otherwise show slot 0
    if (ownedSlotIndices.size > 0) {
      const firstOwnedIndex = Array.from(ownedSlotIndices)[0];
      return allSlots[firstOwnedIndex];
    }
    return allSlots[0];
  }, [allSlots, ownedSlotIndices]);

  const occupantDisplayIsYou = useMemo(() => {
    if (!slotState || !address) return false;
    return slotState.miner.toLowerCase() === address.toLowerCase();
  }, [slotState, address]);

  const [interpolatedMined, setInterpolatedMined] = useState<bigint | null>(null);

  useEffect(() => {
    if (!slotState) {
      setInterpolatedMined(null);
      return;
    }
    setInterpolatedMined(slotState.mined);
    const interval = setInterval(() => {
      if (slotState.pps > 0n) {
        setInterpolatedMined((prev) => {
          if (!prev) return slotState.mined;
          return prev + slotState.pps;
        });
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [slotState]);

  useEffect(() => {
    let cancelled = false;
    const hydrateContext = async () => {
      try {
        const ctx = (await (sdk as unknown as {
          context: Promise<MiniAppContext> | MiniAppContext;
        }).context) as MiniAppContext;
        if (!cancelled) {
          setContext(ctx);
        }
      } catch {
        if (!cancelled) setContext(null);
      }
    };
    hydrateContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        sdk.actions.ready().catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, []);

  const userDisplayName =
    context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username
    ? `@${context.user.username}`
    : context?.user?.fid
      ? `fid ${context.user.fid}`
      : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-2 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-black pb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">ABOUT</h1>
            {context?.user ? (
              <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
                <Avatar className="h-8 w-8 border border-zinc-800">
                  <AvatarImage
                    src={userAvatarUrl || undefined}
                    alt={userDisplayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white">
                    {initialsFrom(userDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left">
                  <div className="text-sm font-bold">{userDisplayName}</div>
                  {userHandle ? (
                    <div className="text-xs text-gray-400">{userHandle}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6 px-2 overflow-y-auto scrollbar-hide flex-1">
            <div className="grid grid-cols-2 gap-2">
              <AddToFarcasterButton
                variant="default"
              />
              <DuneDashboardButton
                variant="default"
              />
            </div>

            {/* Your Stats Section */}
            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">Your Stats</h2>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">ETH:</span>
                  <span className="text-white font-semibold">Ξ{minerState ? formatEth(minerState.ethBalance, 4) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">WETH:</span>
                  <span className="text-white font-semibold">Ξ{minerState && minerState.wethBalance !== undefined
                    ? formatEth(minerState.wethBalance, 4)
                    : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Spent:</span>
                  <span className="text-white font-semibold">Ξ{slotState && occupantDisplayIsYou
                    ? formatEth(slotState.initPrice / 2n, 5)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Earned:</span>
                  <span className="text-white font-semibold">Ξ{slotState && occupantDisplayIsYou && slotState.price > slotState.initPrice
                    ? formatEth((slotState.price * 80n) / 100n, 5)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mined:</span>
                  <span className="text-white font-semibold">▪{slotState && occupantDisplayIsYou && interpolatedMined !== null
                    ? formatTokenAmount(interpolatedMined, DONUT_DECIMALS, 2)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate:</span>
                  <span className="text-white font-semibold">▪{slotState && occupantDisplayIsYou
                    ? formatTokenAmount(slotState.pps, DONUT_DECIMALS, 4)
                    : "0"}/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pixel:</span>
                  <span className="text-white font-semibold">▪{minerState ? formatTokenAmount(minerState.pixelBalance, DONUT_DECIMALS, 2) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Owned:</span>
                  <span className="text-white font-semibold">{ownedSlotIndices.size}</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                What Is Pixel Miner
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Pixel Miner is a competitive mining game on Base</li>
                <li>Mine pixels through a continuous Dutch auction instead of proof-of-work or staking</li>
                <li>Auction revenue increases liquidity and scarcity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                How Mining Works
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Only one active miner at a time controls the mining operation</li>
                <li>The right to mine is bought with ETH through a continuous Dutch auction:</li>
                <li className="pl-6 list-none">- Price doubles after each purchase</li>
                <li className="pl-6 list-none">- Then decays to 0 over one hour</li>
                <li className="pl-6 list-none">- Anyone can purchase control of mining at the current price</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                Revenue Split
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>80% → previous miner</li>
                <li>15% → treasury</li>
                <li>5% → provider (frontend host)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                Emission Schedule
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Starts at 4 PIXEL / sec</li>
                <li>Halving every 30 days</li>
                <li>Tail emission: 0.01 PIXEL / sec (forever)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                Proof of Just-In-Time Stake
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>ETH is "staked" only while controlling mining</li>
                <li>Profit if the next purchase pays more</li>
                <li>Lose if it pays less</li>
                <li>Earn PIXEL the entire time you hold control</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                Treasury
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Treasury ETH is used to buy and burn PIXEL-WETH LP</li>
                <li>Once sufficient liquidity is established, the treasury can be upgraded to buy and burn PIXEL directly, or governance can decide to acquire other assets or reinvest the treasury</li>
              </ul>
            </section>

            <section className="pb-4">
              <h2 className="text-lg font-bold text-cyan-400 mb-2">
                Builder Codes
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Anyone can host their own mining frontend by deploying a client</li>
                <li>Add your builder code to earn 5% of all purchases made through your frontend</li>
                <li>Compete to become the top mining provider on Base</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
