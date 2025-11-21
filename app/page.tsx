"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { CircleUserRound } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { readContract } from "wagmi/actions";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONTRACT_ADDRESSES, MULTICALL_ABI } from "@/lib/contracts";
import { wagmiConfig } from "@/lib/wagmi";
import { cn, getEthPrice } from "@/lib/utils";
import { useAccountData } from "@/hooks/useAccountData";
import { NavBar } from "@/components/nav-bar";
import { AddToFarcasterDialog } from "@/components/add-to-farcaster-dialog";

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
const DEADLINE_BUFFER_SECONDS = 15 * 60;

const toBigInt = (value: bigint | number) =>
  typeof value === "bigint" ? value : BigInt(value);

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

const formatAddress = (addr?: string) => {
  if (!addr) return "—";
  const normalized = addr.toLowerCase();
  if (normalized === zeroAddress) return "No miner";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

const COLORS = [
  "#FF0000", // Red
  "#FF6B00", // Orange
  "#FFD700", // Gold
  "#00FF00", // Lime
  "#00FFFF", // Cyan
  "#0080FF", // Blue
  "#8000FF", // Purple
  "#FF00FF", // Magenta
  "#FF1493", // Deep Pink
  "#FFFFFF", // White
  "#808080", // Gray
  "#000000", // Black
];

const getTextColor = (bgColor: string) => {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
};

export default function HomePage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);
  const [glazeResult, setGlazeResult] = useState<"success" | "failure" | null>(
    null,
  );
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const glazeResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const resetGlazeResult = useCallback(() => {
    if (glazeResultTimeoutRef.current) {
      clearTimeout(glazeResultTimeoutRef.current);
      glazeResultTimeoutRef.current = null;
    }
    setGlazeResult(null);
  }, []);
  const showGlazeResult = useCallback(
    (result: "success" | "failure") => {
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
      }
      setGlazeResult(result);
      glazeResultTimeoutRef.current = setTimeout(() => {
        setGlazeResult(null);
        glazeResultTimeoutRef.current = null;
      }, 3000);
    },
    [],
  );

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
    return () => {
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
      }
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

  // Fetch ETH price on mount and every minute
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getEthPrice();
      setEthUsdPrice(price);
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  useEffect(() => {
    if (
      autoConnectAttempted.current ||
      isConnected ||
      !primaryConnector ||
      isConnecting
    ) {
      return;
    }
    autoConnectAttempted.current = true;
    connectAsync({
      connector: primaryConnector,
      chainId: base.id,
    }).catch(() => {
      // Ignore auto-connect failures; user can connect manually.
    });
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  const { data: rawMinerState, refetch: refetchMinerState } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getMiner",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: {
      refetchInterval: 10_000,
    },
  });

  const minerState = useMemo(() => {
    if (!rawMinerState) return undefined;
    return rawMinerState as unknown as MinerState;
  }, [rawMinerState]);

  // Fetch all slots (0-255) in one call - super efficient!
  const { data: rawAllSlots, refetch: refetchAllSlots } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getSlots",
    args: [BigInt(0), BigInt(255)],
    chainId: base.id,
    query: {
      refetchInterval: 8_000, // Refresh every 8 seconds
    },
  });

  const allSlots = useMemo(() => {
    if (!rawAllSlots) return [];
    const slots = rawAllSlots as unknown as SlotState[];
    // Debug: Log slot 0 to check multiplier
    if (slots.length > 0) {
      console.log('Slot 0 data:', {
        epochId: slots[0].epochId.toString(),
        initPrice: slots[0].initPrice.toString(),
        startTime: slots[0].startTime.toString(),
        price: slots[0].price.toString(),
        multiplier: slots[0].multiplier.toString(),
        multiplierFormatted: formatUnits(slots[0].multiplier, 18),
        pps: slots[0].pps.toString(),
        mined: slots[0].mined.toString(),
        miner: slots[0].miner,
        color: slots[0].color,
      });
    }
    return slots;
  }, [rawAllSlots]);

  // Get the selected slot from the allSlots array
  const slotState = useMemo(() => {
    if (!allSlots || allSlots.length === 0) return undefined;
    return allSlots[selectedIndex];
  }, [allSlots, selectedIndex]);

  // Find which slots the current user owns
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

  const { data: accountData } = useAccountData(address);

  useEffect(() => {
    if (!readyRef.current && minerState) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, [minerState]);

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
  });

  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "success" || receipt.status === "reverted") {
      showGlazeResult(
        receipt.status === "success" ? "success" : "failure",
      );
      refetchMinerState();
      refetchAllSlots(); // Refresh the entire grid
      const resetTimer = setTimeout(() => {
        resetWrite();
      }, 500);
      return () => clearTimeout(resetTimer);
    }
    return;
  }, [receipt, refetchMinerState, refetchAllSlots, resetWrite, showGlazeResult]);

  const minerAddress = slotState?.miner ?? zeroAddress;
  const hasMiner = minerAddress !== zeroAddress;

  const claimedHandleParam = (slotState?.color ?? "").trim();

  const { data: neynarUser } = useQuery<{
    user: {
      fid: number | null;
      username: string | null;
      displayName: string | null;
      pfpUrl: string | null;
    } | null;
  }>({
    queryKey: ["neynar-user", minerAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/neynar/user?address=${encodeURIComponent(minerAddress)}`,
      );
      if (!res.ok) {
        throw new Error("Failed to load Farcaster profile.");
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
    enabled: hasMiner,
    staleTime: 60_000,
    retry: false,
  });

  const handleGlaze = useCallback(async () => {
    if (!slotState) return;
    resetGlazeResult();
    try {
      let targetAddress = address;
      if (!targetAddress) {
        if (!primaryConnector) {
          throw new Error("Wallet connector not available yet.");
        }
        const result = await connectAsync({
          connector: primaryConnector,
          chainId: base.id,
        });
        targetAddress = result.accounts[0];
      }
      if (!targetAddress) {
        throw new Error("Unable to determine wallet address.");
      }
      const price = slotState.price;
      const epochId = slotState.epochId;
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS,
      );
      const maxPrice = price === 0n ? 0n : (price * 105n) / 100n;

      // Get entropy fee
      const entropyFee = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "getEntropyFee",
        chainId: base.id,
      }) as bigint;

      await writeContract({
        account: targetAddress as Address,
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "mine",
        args: [
          CONTRACT_ADDRESSES.provider as Address,
          BigInt(selectedIndex),
          epochId,
          deadline,
          maxPrice,
          selectedColor,
        ],
        value: price + entropyFee,
        chainId: base.id,
      });
    } catch (error) {
      console.error("Failed to mine:", error);
      showGlazeResult("failure");
      resetWrite();
    }
  }, [
    address,
    connectAsync,
    selectedColor,
    selectedIndex,
    slotState,
    primaryConnector,
    resetGlazeResult,
    resetWrite,
    showGlazeResult,
    writeContract,
  ]);

  // Local state for smooth mined counter interpolation
  const [interpolatedMined, setInterpolatedMined] = useState<bigint | null>(null);

  // Update interpolated mined amount smoothly between fetches
  useEffect(() => {
    if (!slotState) {
      setInterpolatedMined(null);
      return;
    }

    // Start with the fetched value
    setInterpolatedMined(slotState.mined);

    // Update every second with interpolated value
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

  const occupantDisplay = useMemo(() => {
    if (!slotState) {
      return {
        primary: "—",
        secondary: "",
        isYou: false,
        avatarUrl: null as string | null,
        isUnknown: true,
        addressLabel: "—",
      };
    }
    const minerAddr = slotState.miner;
    const fallback = formatAddress(minerAddr);
    const isYou =
      !!address &&
      minerAddr.toLowerCase() === (address as string).toLowerCase();

    const fallbackAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(
      minerAddr.toLowerCase(),
    )}`;

    const profile = neynarUser?.user ?? null;
    const profileUsername = profile?.username
      ? `@${profile.username}`
      : null;
    const profileDisplayName = profile?.displayName ?? null;

    const contextProfile = context?.user ?? null;
    const contextHandle = contextProfile?.username
      ? `@${contextProfile.username}`
      : null;
    const contextDisplayName = contextProfile?.displayName ?? null;

    const claimedHandle = claimedHandleParam
      ? claimedHandleParam.startsWith("@")
        ? claimedHandleParam
        : `@${claimedHandleParam}`
      : null;

    const addressLabel = fallback;

    const labelCandidates = [
      profileDisplayName,
      profileUsername,
      isYou ? contextDisplayName : null,
      isYou ? contextHandle : null,
      addressLabel,
    ].filter((label): label is string => !!label);

    const seenLabels = new Set<string>();
    const uniqueLabels = labelCandidates.filter((label) => {
      const key = label.toLowerCase();
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });

    const primary = uniqueLabels[0] ?? addressLabel;

    const secondary =
      uniqueLabels.find(
        (label) => label !== primary && label.startsWith("@"),
      ) ?? "";

    const avatarUrl =
      profile?.pfpUrl ??
      (isYou ? contextProfile?.pfpUrl ?? null : null) ??
      fallbackAvatarUrl;

    const isUnknown =
      !profile && !claimedHandle && !(isYou && (contextHandle || contextDisplayName));

    return {
      primary,
      secondary,
      isYou,
      avatarUrl,
      isUnknown,
      addressLabel,
    };
  }, [
    address,
    claimedHandleParam,
    context?.user?.displayName,
    context?.user?.pfpUrl,
    context?.user?.username,
    slotState,
    neynarUser?.user,
  ]);

  const glazeRateDisplay = slotState
    ? formatTokenAmount(slotState.pps, DONUT_DECIMALS, 4)
    : "—";
  const glazePriceDisplay = slotState
    ? `Ξ${formatEth(slotState.price, slotState.price === 0n ? 0 : 5)}`
    : "Ξ—";
  const minedDisplay = slotState && interpolatedMined !== null
    ? `▪${formatTokenAmount(interpolatedMined, DONUT_DECIMALS, 2)}`
    : "▪—";

  // Calculate USD values for pixels
  const minedUsdValue = minerState && minerState.pixelPrice > 0n && interpolatedMined !== null
    ? (Number(formatEther(interpolatedMined)) * Number(formatEther(minerState.pixelPrice)) * ethUsdPrice).toFixed(2)
    : "0.00";

  const glazeRateUsdValue = minerState && slotState && minerState.pixelPrice > 0n
    ? (Number(formatUnits(slotState.pps, DONUT_DECIMALS)) * Number(formatEther(minerState.pixelPrice)) * ethUsdPrice).toFixed(4)
    : "0.0000";

  // Calculate PNL in USD
  const pnlUsdValue = slotState
    ? (() => {
        const halfInitPrice = slotState.initPrice / 2n;
        const pnl = slotState.price > slotState.initPrice
          ? (slotState.price * 80n) / 100n - halfInitPrice
          : slotState.price - halfInitPrice;
        const pnlEth = Number(formatEther(pnl >= 0n ? pnl : -pnl));
        const pnlUsd = pnlEth * ethUsdPrice;
        const sign = pnl >= 0n ? "+" : "-";
        return `${sign}$${pnlUsd.toFixed(2)}`;
      })()
    : "$0.00";

  const occupantInitialsSource = occupantDisplay.isUnknown
    ? occupantDisplay.addressLabel
    : occupantDisplay.primary || occupantDisplay.addressLabel;

  const occupantFallbackInitials = occupantDisplay.isUnknown
    ? (occupantInitialsSource?.slice(-2) ?? "??").toUpperCase()
    : initialsFrom(occupantInitialsSource);

  const pixelBalanceDisplay =
    minerState && minerState.pixelBalance !== undefined
      ? formatTokenAmount(minerState.pixelBalance, DONUT_DECIMALS, 2)
      : "—";
  const ethBalanceDisplay =
    minerState && minerState.ethBalance !== undefined
      ? formatEth(minerState.ethBalance, 4)
      : "—";

  const buttonLabel = useMemo(() => {
    if (!slotState) return "Loading…";
    if (glazeResult === "success") return "SUCCESS";
    if (glazeResult === "failure") return "FAILURE";
    if (isWriting || isConfirming) {
      return "MINING…";
    }
    return "MINE";
  }, [glazeResult, isConfirming, isWriting, slotState]);

  const isGlazeDisabled =
    !slotState || isWriting || isConfirming || glazeResult !== null;

  const handleViewKingGlazerProfile = useCallback(() => {
    const fid = neynarUser?.user?.fid;
    const username = neynarUser?.user?.username;
    console.log("King Glazer clicked, FID:", fid, "Username:", username);

    if (username) {
      // Open Farcaster profile URL using username (cleaner URL)
      window.open(`https://warpcast.com/${username}`, "_blank", "noopener,noreferrer");
    } else if (fid) {
      // Fallback to FID-based URL if username not available
      window.open(`https://warpcast.com/~/profiles/${fid}`, "_blank", "noopener,noreferrer");
    } else {
      console.log("No FID or username available for King Glazer");
    }
  }, [neynarUser?.user?.fid, neynarUser?.user?.username]);

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
      {/* Add to Farcaster Dialog - shows on first visit */}
      <AddToFarcasterDialog showOnFirstVisit={true} />

      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-1.5 pb-2 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 4px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-0.5">
            <h1 className="text-xl font-bold tracking-wide">GRID</h1>
            {context?.user ? (
              <div className="flex items-center gap-1.5 rounded-full bg-black px-2 py-0.5">
                <Avatar className="h-6 w-6 border border-zinc-800">
                  <AvatarImage
                    src={userAvatarUrl || undefined}
                    alt={userDisplayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white text-[10px]">
                    {initialsFrom(userDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left">
                  <div className="text-xs font-bold">{userDisplayName}</div>
                  {userHandle ? (
                    <div className="text-[10px] text-gray-400">{userHandle}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <Card
            className={cn(
              "border-zinc-800 bg-black transition-shadow",
              occupantDisplay.isYou &&
                "border-cyan-500 shadow-[inset_0_0_24px_rgba(34,211,238,0.55)] animate-glow",
            )}
          >
            <CardContent className="flex items-center justify-between gap-2 p-2">
              {/* Miner Section */}
              <div
                className={cn(
                  "flex items-center gap-1.5 min-w-0 flex-1",
                  neynarUser?.user?.fid && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={neynarUser?.user?.fid ? handleViewKingGlazerProfile : undefined}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage
                    src={occupantDisplay.avatarUrl || undefined}
                    alt={occupantDisplay.primary}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white text-xs uppercase">
                    {minerState ? (
                      occupantFallbackInitials
                    ) : (
                      <CircleUserRound className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <div
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-[0.08em]",
                        occupantDisplay.isYou
                          ? "text-cyan-400"
                          : "text-gray-400",
                      )}
                    >
                      MINER
                    </div>
                    {/* Multiplier Badge - Next to MINER label */}
                    <div className="bg-cyan-500 text-black text-[8px] font-bold px-1 py-0.5 rounded-full leading-none">
                      ×{slotState && slotState.multiplier !== undefined ? Number(formatUnits(slotState.multiplier, 18)).toFixed(1) : "0.0"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white truncate">
                    <span className="truncate">{occupantDisplay.primary}</span>
                  </div>
                </div>
              </div>

              {/* Stats Section - Mined and PNL stacked */}
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                {/* Mined Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-gray-400 w-10 text-right">
                    MINED
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {minedDisplay}
                  </div>
                  <div className="text-[9px] text-gray-400">
                    ${minedUsdValue}
                  </div>
                </div>

                {/* PNL Row */}
                <div className="flex items-center gap-1">
                  <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-gray-400 w-10 text-right">
                    PNL
                  </div>
                  <div className={cn(
                    "text-xs font-semibold",
                    slotState && (() => {
                      const halfInitPrice = slotState.initPrice / 2n;
                      const pnl = slotState.price > slotState.initPrice
                        ? (slotState.price * 80n) / 100n - halfInitPrice
                        : slotState.price - halfInitPrice;
                      return pnl >= 0n;
                    })()
                      ? "text-green-400"
                      : "text-red-400"
                  )}>
                    {slotState
                      ? (() => {
                          const halfInitPrice = slotState.initPrice / 2n;
                          const pnl = slotState.price > slotState.initPrice
                            ? (slotState.price * 80n) / 100n - halfInitPrice
                            : slotState.price - halfInitPrice;
                          const sign = pnl >= 0n ? "+" : "-";
                          const absolutePnl = pnl >= 0n ? pnl : -pnl;
                          return `${sign}Ξ${formatEth(absolutePnl, 5)}`;
                        })()
                      : "Ξ—"}
                  </div>
                  <div className="text-[9px] text-gray-400">
                    {pnlUsdValue}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-1 flex justify-center">
            <div
              className="grid gap-[0.5px] bg-zinc-900 p-[0.5px] rounded w-full max-w-full"
              style={{
                gridTemplateColumns: "repeat(16, 1fr)",
              }}
            >
              {Array.from({ length: 256 }).map((_, index) => {
                const isOwned = ownedSlotIndices.has(index);
                const isSelected = index === selectedIndex;
                const slot = allSlots[index];
                const pixelColor = isSelected ? selectedColor : (slot?.color || "#3f3f46"); // Show selected color if selected, otherwise slot color

                return (
                  <div
                    key={index}
                    className={cn(
                      "aspect-square transition-all cursor-pointer",
                      isSelected && "scale-125 z-10 shadow-2xl",
                      isOwned && "ring-1 ring-cyan-400"
                    )}
                    style={{
                      backgroundColor: pixelColor,
                    }}
                    onClick={() => setSelectedIndex(index)}
                    title={`Pixel #${index}${isOwned ? " (Owned)" : ""}${isSelected ? " (Selected)" : ""}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-1 pb-1">
            <div className="grid grid-cols-2 gap-1">
              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-0.5 p-1.5">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    MINING RATE
                  </div>
                  <div className="text-base font-semibold text-white">
                    ▪{glazeRateDisplay}<span className="text-[9px] text-gray-400">/s</span>
                  </div>
                  <div className="text-[8px] text-gray-400">
                    ${glazeRateUsdValue}/s
                  </div>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-black">
                <CardContent className="grid gap-0.5 p-1.5">
                  <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400">
                    MINING PRICE
                  </div>
                  <div className="text-base font-semibold text-cyan-400">
                    {glazePriceDisplay}
                  </div>
                  <div className="text-[8px] text-gray-400">
                    ${slotState ? (Number(formatEther(slotState.price)) * ethUsdPrice).toFixed(2) : "0.00"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-1 items-center">
              <div className="grid grid-cols-6 gap-0.5">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-4 h-4 rounded border transition-colors",
                      selectedColor === color
                        ? "border-cyan-400 ring-1 ring-cyan-400"
                        : "border-zinc-700 hover:border-cyan-400"
                    )}
                    style={{backgroundColor: color}}
                  />
                ))}
              </div>
              <Button
                className="flex-1 rounded-xl bg-cyan-500 hover:bg-cyan-600 py-1.5 text-xs font-bold text-black shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleGlaze}
                disabled={isGlazeDisabled}
              >
                {buttonLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
