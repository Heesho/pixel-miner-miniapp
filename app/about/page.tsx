"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useReadContract } from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavBar } from "@/components/nav-bar";
import { AddToFarcasterButton } from "@/components/add-to-farcaster-button";
import { DuneDashboardButton } from "@/components/dune-dashboard-button";
import { CoreIcon } from "@/components/core-icon";
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
  ups: bigint;
  unitPrice: bigint;
  unitBalance: bigint;
  ethBalance: bigint;
  wethBalance: bigint;
};

type SlotState = {
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  price: bigint;
  ups: bigint;
  multiplier: bigint;
  multiplierTime: bigint;
  mined: bigint;
  miner: Address;
  uri: string;
};

const CORE_DECIMALS = 18;

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
      if (slotState.ups > 0n) {
        setInterpolatedMined((prev) => {
          if (!prev) return slotState.mined;
          return prev + slotState.ups;
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

  // Fetch Neynar profile for the connected user
  const { data: connectedUserProfile } = useQuery<{
    user: {
      fid: number | null;
      username: string | null;
      displayName: string | null;
      pfpUrl: string | null;
    } | null;
  }>({
    queryKey: ["neynar-connected-user", address],
    queryFn: async () => {
      if (!address) return { user: null };
      const res = await fetch(
        `/api/neynar/user?address=${encodeURIComponent(address)}`,
      );
      if (!res.ok) {
        return { user: null };
      }
      return (await res.json()) as {
        user: {
          fid: number | null;
          username: string | null;
          displayName: string | null;
          pfpUrl: string | null;
        } | null;
      };
    },
    enabled: !!address,
    refetchOnWindowFocus: false,
  });

  const userDisplayName =
    context?.user?.displayName ??
    context?.user?.username ??
    connectedUserProfile?.user?.displayName ??
    connectedUserProfile?.user?.username ??
    (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "User");
  const userHandle = context?.user?.username
    ? `@${context.user.username}`
    : connectedUserProfile?.user?.username
      ? `@${connectedUserProfile.user.username}`
      : context?.user?.fid
        ? `fid ${context.user.fid}`
        : connectedUserProfile?.user?.fid
          ? `fid ${connectedUserProfile.user.fid}`
          : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? connectedUserProfile?.user?.pfpUrl ?? null;

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-zinc-950 text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950">
          <h1 className="text-2xl font-bold tracking-wide">About</h1>
          {(context?.user || connectedUserProfile?.user || address) ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={userAvatarUrl || undefined}
                  alt={userDisplayName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-zinc-700 text-white text-xs font-bold">
                  {initialsFrom(userDisplayName)}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight text-right">
                <div className="text-base font-bold text-white">{userDisplayName}</div>
                {userHandle ? (
                  <div className="text-xs text-zinc-400">{userHandle}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* Buttons */}
          <div className="flex">
            <div className="flex-1">
              <AddToFarcasterButton variant="default" />
            </div>
            <div className="flex-1">
              <DuneDashboardButton variant="default" />
            </div>
          </div>

          {/* Your Stats Section */}
          <section className="bg-zinc-800 px-4 py-3">
              <h2 className="text-sm font-bold text-white mb-2">Your Stats</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">CORE</span>
                  <span className="text-white font-bold flex items-center gap-1"><CoreIcon size={10} />{minerState ? formatTokenAmount(minerState.unitBalance, CORE_DECIMALS, 2) : "—"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Mined</span>
                  <span className="text-white font-bold flex items-center gap-1"><CoreIcon size={10} />{slotState && occupantDisplayIsYou && interpolatedMined !== null
                    ? formatTokenAmount(interpolatedMined, CORE_DECIMALS, 2)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">ETH</span>
                  <span className="text-white font-bold">Ξ{minerState ? formatEth(minerState.ethBalance, 4) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Spent</span>
                  <span className="text-white font-bold">Ξ{slotState && occupantDisplayIsYou
                    ? formatEth(slotState.initPrice / 2n, 5)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">WETH</span>
                  <span className="text-white font-bold">Ξ{minerState && minerState.wethBalance !== undefined
                    ? formatEth(minerState.wethBalance, 4)
                    : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Earned</span>
                  <span className="text-white font-bold">Ξ{slotState && occupantDisplayIsYou && slotState.price > slotState.initPrice
                    ? formatEth((slotState.price * 80n) / 100n, 5)
                    : "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Owned</span>
                  <span className="text-white font-bold">{ownedSlotIndices.size}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Rate</span>
                  <span className="text-white font-bold flex items-center gap-1"><CoreIcon size={10} />{slotState && occupantDisplayIsYou
                    ? formatTokenAmount(slotState.ups, CORE_DECIMALS, 4)
                    : "0"}/s</span>
                </div>
              </div>
          </section>

          <section className="bg-zinc-700 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              What Is Pixel Miner
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>Pixel Miner is a competitive mining game on Base</li>
                <li>Mine pixels through a continuous Dutch auction instead of proof-of-work or staking</li>
                <li>Auction revenue increases liquidity and scarcity</li>
              </ul>
          </section>

          <section className="bg-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              How Mining Works
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>Only one active miner at a time controls the mining operation</li>
                <li>The right to mine is bought with ETH through a continuous Dutch auction:</li>
                <li className="pl-4 list-none">- Price doubles after each purchase</li>
                <li className="pl-4 list-none">- Then decays to 0 over one hour</li>
                <li className="pl-4 list-none">- Anyone can purchase control of mining at the current price</li>
              </ul>
          </section>

          <section className="bg-zinc-700 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              Revenue Split
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>80% → previous miner</li>
                <li>15% → treasury</li>
                <li>5% → provider (frontend host)</li>
              </ul>
          </section>

          <section className="bg-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              Emission Schedule
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>Starts at 2 CORE / sec</li>
                <li>Halving every 30 days</li>
                <li>Tail emission: 0.01 CORE / sec (forever)</li>
              </ul>
          </section>

          <section className="bg-zinc-700 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              Proof of Just-In-Time Stake
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>ETH is "staked" only while controlling mining</li>
                <li>Profit if the next purchase pays more</li>
                <li>Lose if it pays less</li>
                <li>Earn CORE the entire time you hold control</li>
              </ul>
          </section>

          <section className="bg-zinc-800 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              Treasury
            </h2>
              <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
                <li>Treasury ETH is used to buy and burn CORE-WETH LP</li>
                <li>Once sufficient liquidity is established, the treasury can be upgraded to buy and burn CORE directly, or governance can decide to acquire other assets or reinvest the treasury</li>
              </ul>
          </section>

          <section className="bg-zinc-700 px-4 py-3">
            <h2 className="text-sm font-bold text-white mb-2">
              Builder Codes
            </h2>
            <ul className="space-y-1 text-sm text-zinc-300 list-disc list-inside">
              <li>Anyone can host their own mining frontend by deploying a client</li>
              <li>Add your builder code to earn 5% of all purchases made through your frontend</li>
              <li>Compete to become the top mining provider on Base</li>
            </ul>
          </section>

          {/* Nav spacer */}
          <div className="h-14 bg-zinc-950 flex-shrink-0" />
        </div>
      </div>
      <NavBar />
    </main>
  );
}
