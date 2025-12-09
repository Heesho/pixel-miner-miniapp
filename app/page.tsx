"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import { CircleUserRound } from "lucide-react";
import {
  useAccount,
  useConnect,
  useReadContract,
  useReconnect,
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
import { WorldMap } from "@/components/world-map";
import { TilePlacer } from "@/components/tile-placer";
import { CoreIcon } from "@/components/core-icon";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type RigState = {
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
  rig: Address;
  uri: string;
};

const CORE_DECIMALS = 18;
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

const formatCountdown = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const formatElapsedTime = (seconds: number) => {
  if (seconds <= 0) return "0m 0s";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m ${secs}s`;
  }
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

const getTextColor = (bgColor: string) => {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
};

// Territory colors for different players
const TERRITORY_COLORS = [
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#45B7D1", // Blue
  "#FFA07A", // Light Salmon
  "#98D8C8", // Mint
  "#F7DC6F", // Yellow
  "#BB8FCE", // Purple
  "#85C1E2", // Sky Blue
  "#F8B88B", // Peach
  "#A8E6CF", // Light Green
  "#FFD3B6", // Apricot
  "#FFAAA5", // Light Coral
];

// Generate a consistent color for a given address
const getPlayerColor = (address: string): string => {
  if (!address || address === zeroAddress) return "#3f3f46";

  // Use the address to generate a consistent index
  const hash = address.toLowerCase().split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return TERRITORY_COLORS[hash % TERRITORY_COLORS.length];
};

export default function HomePage() {
  const readyRef = useRef(false);
  const sdkInitialized = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);
  const [glazeResult, setGlazeResult] = useState<"success" | "failure" | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [territoryOwnerPfps, setTerritoryOwnerPfps] = useState<Map<number, string>>(new Map());
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
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

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();
  const { reconnectAsync } = useReconnect();
  const primaryConnector = connectors[0];

  // Initialize SDK and establish wallet connection in proper sequence
  useEffect(() => {
    let cancelled = false;

    const initializeApp = async () => {
      // Skip if already initialized
      if (sdkInitialized.current) return;
      sdkInitialized.current = true;

      try {
        // Step 1: Get SDK context (this ensures SDK is ready)
        const ctx = (await (sdk as unknown as {
          context: Promise<MiniAppContext> | MiniAppContext;
        }).context) as MiniAppContext;

        if (!cancelled) {
          setContext(ctx);
        }

        // Step 2: Reconnect wallet using wagmi's reconnect
        // This properly handles the farcasterMiniApp connector's async provider
        try {
          await reconnectAsync();
        } catch {
          // Reconnect failed, try fresh connect
          if (primaryConnector && !cancelled) {
            try {
              await connectAsync({
                connector: primaryConnector,
                chainId: base.id,
              });
            } catch {
              // Ignore connection errors - user can connect manually
            }
          }
        }

        // Step 3: Signal ready to hide splash screen
        if (!cancelled && !readyRef.current) {
          readyRef.current = true;
          sdk.actions.ready().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setContext(null);
          // Still try to connect even if context fails (might be outside Mini App)
          if (primaryConnector) {
            try {
              await reconnectAsync();
            } catch {
              // Ignore
            }
          }
          // Signal ready even on error to avoid stuck splash
          if (!readyRef.current) {
            readyRef.current = true;
            sdk.actions.ready().catch(() => {});
          }
        }
      }
    };

    initializeApp();

    return () => {
      cancelled = true;
    };
  }, [connectAsync, primaryConnector, reconnectAsync]);

  useEffect(() => {
    return () => {
      if (glazeResultTimeoutRef.current) {
        clearTimeout(glazeResultTimeoutRef.current);
      }
    };
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

  const { data: rawRigState, refetch: refetchRigState } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall,
    abi: MULTICALL_ABI,
    functionName: "getRig",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: {
      refetchInterval: 10_000,
    },
  });

  const rigState = useMemo(() => {
    if (!rawRigState) return undefined;
    return rawRigState as unknown as RigState;
  }, [rawRigState]);

  // Fetch all slots (0-255) - 256 pixels in 16x16 grid
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
    return rawAllSlots as unknown as SlotState[];
  }, [rawAllSlots]);

  // Track ripple effect - source pixel index and its color
  const [ripple, setRipple] = useState<{ sourceIndex: number; color: string } | null>(null);
  const previousSlotsRef = useRef<Map<number, string>>(new Map()); // Map of slot index -> uri

  // Detect when slots change and trigger ripple
  useEffect(() => {
    if (!allSlots || allSlots.length === 0) return;

    const currentSlots = new Map<number, string>();
    allSlots.forEach((slot, index) => {
      if (slot?.uri) {
        currentSlots.set(index, slot.uri);
      }
    });

    // On first load, just store the current state
    if (previousSlotsRef.current.size === 0) {
      previousSlotsRef.current = currentSlots;
      return;
    }

    // Find the first slot where the uri (color) changed
    let changedIndex: number | null = null;
    let changedColor: string | null = null;

    currentSlots.forEach((uri, index) => {
      if (changedIndex !== null) return; // Only take the first change
      const prevUri = previousSlotsRef.current.get(index);
      if (prevUri !== uri && uri && /^#[0-9A-F]{6}$/i.test(uri)) {
        changedIndex = index;
        changedColor = uri;
      }
    });

    if (changedIndex !== null && changedColor !== null) {
      console.log("Ripple triggered from pixel", changedIndex, "with color", changedColor);
      setRipple({ sourceIndex: changedIndex, color: changedColor });

      // Clear ripple after animation completes (longest delay + animation duration)
      // Max distance in 16x16 grid is about 21 pixels, delay is 50ms per unit, animation is 400ms
      setTimeout(() => {
        setRipple(null);
      }, 1500);
    }

    previousSlotsRef.current = currentSlots;
  }, [allSlots]);

  // Fetch profile pictures for territory owners - disabled for now to reduce API calls
  // useEffect(() => {
  //   const fetchPfps = async () => {
  //     const newPfps = new Map<number, string>();
  //     for (let i = 0; i < allSlots.length; i++) {
  //       const slot = allSlots[i];
  //       if (slot && slot.miner && slot.miner !== zeroAddress) {
  //         try {
  //           const res = await fetch(`/api/neynar/user?address=${encodeURIComponent(slot.miner)}`);
  //           if (res.ok) {
  //             const data = await res.json();
  //             if (data.user?.pfpUrl) {
  //               newPfps.set(i, data.user.pfpUrl);
  //             }
  //           }
  //         } catch (error) {
  //           // Silently ignore pfp fetch errors
  //         }
  //       }
  //     }
  //     setTerritoryOwnerPfps(newPfps);
  //   };
  //   if (allSlots.length > 0) {
  //     fetchPfps();
  //   }
  // }, [allSlots]);

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
      if (slot && slot.rig && slot.rig !== zeroAddress && slot.rig.toLowerCase() === address.toLowerCase()) {
        owned.add(index);
      }
    });
    return owned;
  }, [address, allSlots]);

  const { data: accountData } = useAccountData(address);

  useEffect(() => {
    if (!readyRef.current && rigState) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, [rigState]);

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

      // For the placer, just clear the color - no animation needed since they saw the preview
      // Animation is for OTHER users who will see it when their contract data updates
      setSelectedColor(null);
      refetchRigState();
      refetchAllSlots();
      const resetTimer = setTimeout(() => {
        resetWrite();
      }, 500);
      return () => clearTimeout(resetTimer);
    }
    return;
  }, [receipt, refetchRigState, refetchAllSlots, resetWrite, showGlazeResult, selectedIndex, selectedColor]);

  const rigAddress = slotState?.rig ?? zeroAddress;
  const hasRig = rigAddress !== zeroAddress;

  const claimedHandleParam = (slotState?.uri ?? "").trim();

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

  const { data: neynarUser } = useQuery<{
    user: {
      fid: number | null;
      username: string | null;
      displayName: string | null;
      pfpUrl: string | null;
    } | null;
  }>({
    queryKey: ["neynar-user", rigAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/neynar/user?address=${encodeURIComponent(rigAddress)}`,
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
    enabled: hasRig,
    staleTime: 60_000,
    retry: false,
  });

  const handleGlaze = useCallback(async () => {
    if (!slotState || !selectedColor) return;
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

      // Fetch fresh slot data right before transaction to avoid stale price/epochId
      const freshSlotData = await readContract(wagmiConfig, {
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "getSlot",
        args: [BigInt(selectedIndex)],
        chainId: base.id,
      }) as unknown as SlotState;

      const price = freshSlotData.price;
      const epochId = freshSlotData.epochId;
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
          CONTRACT_ADDRESSES.faction as Address,
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
    selectedIndex,
    slotState,
    selectedColor,
    primaryConnector,
    resetGlazeResult,
    resetWrite,
    showGlazeResult,
    writeContract,
  ]);

  // Local state for smooth mined counter interpolation
  const [interpolatedMined, setInterpolatedMined] = useState<bigint | null>(null);

  // Local state for countdown timer
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // Local state for time elapsed since slot was mined
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

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
      if (slotState.ups > 0n) {
        setInterpolatedMined((prev) => {
          if (!prev) return slotState.mined;
          return prev + slotState.ups;
        });
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, [slotState]);

  // Update countdown timer for multiplier
  useEffect(() => {
    if (!slotState) {
      setCountdownSeconds(0);
      return;
    }

    // Initialize countdown from contract value
    const initialSeconds = Number(slotState.multiplierTime);
    setCountdownSeconds(initialSeconds);

    if (initialSeconds === 0) return;

    // Decrement every second
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, [slotState]);

  // Update elapsed time since slot was mined
  useEffect(() => {
    if (!slotState || !slotState.startTime || Number(slotState.startTime) === 0) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = Number(slotState.startTime);
    const updateElapsed = () => {
      const now = Math.floor(Date.now() / 1000);
      setElapsedSeconds(Math.max(0, now - startTime));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1_000);

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
    const rigAddr = slotState.rig;
    const fallback = formatAddress(rigAddr);
    const isYou =
      !!address &&
      rigAddr.toLowerCase() === (address as string).toLowerCase();

    const fallbackAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(
      rigAddr.toLowerCase(),
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

  // Use slot ups if available and > 0, otherwise fall back to base rig ups divided by capacity (256 slots)
  // INITIAL_UPS from contract is 2 ether (2e18) as fallback if rigState not loaded
  const CAPACITY = 256n;
  const INITIAL_UPS = 2000000000000000000n; // 2 ether in wei
  const baseUps = rigState?.ups && rigState.ups > 0n ? rigState.ups : INITIAL_UPS;
  const displayUps = slotState && slotState.ups > 0n
    ? slotState.ups
    : (baseUps / CAPACITY);
  const glazeRateDisplay = formatTokenAmount(displayUps, CORE_DECIMALS, 4);
  const glazePriceDisplay = slotState
    ? `Ξ${formatEth(slotState.price, slotState.price === 0n ? 0 : 5)}`
    : "Ξ—";
  const minedDisplayValue = slotState && interpolatedMined !== null
    ? `+${formatTokenAmount(interpolatedMined, CORE_DECIMALS, 2)}`
    : "—";

  // Calculate USD values for CORE
  const minedUsdValue = rigState && rigState.unitPrice > 0n && interpolatedMined !== null
    ? (Number(formatEther(interpolatedMined)) * Number(formatEther(rigState.unitPrice)) * ethUsdPrice).toFixed(2)
    : "0.00";

  const glazeRateUsdValue = rigState && rigState.unitPrice > 0n
    ? (Number(formatUnits(displayUps, CORE_DECIMALS)) * Number(formatEther(rigState.unitPrice)) * ethUsdPrice).toFixed(4)
    : "0.0000";

  // Calculate PNL: currentPrice * 0.8 - initPrice / 2
  const pnlEth = slotState
    ? (() => {
        const halfInitPrice = slotState.initPrice / 2n;
        const currentValue = (slotState.price * 80n) / 100n;
        const pnl = currentValue - halfInitPrice;
        return pnl;
      })()
    : 0n;

  const pnlUsdRaw = slotState
    ? (() => {
        const pnlEthNum = Number(formatEther(pnlEth >= 0n ? pnlEth : -pnlEth));
        const pnlUsd = pnlEthNum * ethUsdPrice;
        return pnlEth >= 0n ? pnlUsd : -pnlUsd;
      })()
    : 0;

  const pnlUsdValue = pnlUsdRaw >= 0 ? `+$${pnlUsdRaw.toFixed(2)}` : `-$${Math.abs(pnlUsdRaw).toFixed(2)}`;

  // Calculate total (mined USD + PNL USD)
  const minedUsdRaw = parseFloat(minedUsdValue);
  const totalUsdValue = (minedUsdRaw + pnlUsdRaw).toFixed(2);
  const totalIsPositive = (minedUsdRaw + pnlUsdRaw) >= 0;

  const occupantInitialsSource = occupantDisplay.isUnknown
    ? occupantDisplay.addressLabel
    : occupantDisplay.primary || occupantDisplay.addressLabel;

  const occupantFallbackInitials = occupantDisplay.isUnknown
    ? (occupantInitialsSource?.slice(-2) ?? "??").toUpperCase()
    : initialsFrom(occupantInitialsSource);

  const unitBalanceDisplay =
    rigState && rigState.unitBalance !== undefined
      ? formatTokenAmount(rigState.unitBalance, CORE_DECIMALS, 2)
      : "—";
  const ethBalanceDisplay =
    rigState && rigState.ethBalance !== undefined
      ? formatEth(rigState.ethBalance, 4)
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
    !slotState || !selectedColor || isWriting || isConfirming || glazeResult !== null;

  const handleViewKingGlazerProfile = useCallback(() => {
    const fid = neynarUser?.user?.fid;
    const username = neynarUser?.user?.username;

    if (username) {
      // Open Farcaster profile URL using username (cleaner URL)
      window.open(`https://warpcast.com/${username}`, "_blank", "noopener,noreferrer");
    } else if (fid) {
      // Fallback to FID-based URL if username not available
      window.open(`https://warpcast.com/~/profiles/${fid}`, "_blank", "noopener,noreferrer");
    }
  }, [neynarUser?.user?.fid, neynarUser?.user?.username]);

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
      {/* Add to Farcaster Dialog - shows on first visit */}
      <AddToFarcasterDialog showOnFirstVisit={true} />

      <div
        className="relative flex h-full w-full max-w-[520px] flex-col overflow-hidden"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Header - solid dark block */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950">
          <h1 className="text-2xl font-bold tracking-wide">
            Grid
          </h1>
          {(context?.user || connectedUserProfile?.user || address || isConnected) ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={userAvatarUrl || undefined}
                  alt={userDisplayName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-zinc-700 text-white text-xs font-bold">
                  {address ? initialsFrom(userDisplayName) : "..."}
                </AvatarFallback>
              </Avatar>
              <div className="leading-tight">
                <div className="text-base font-bold text-white">{userDisplayName}</div>
                {userHandle ? (
                  <div className="text-[10px] text-zinc-400">{userHandle}</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Owner Stats Bar - two columns, same color to look like one box */}
        <div
          className={cn(
            "flex bg-zinc-800",
            occupantDisplay.isYou && "bg-zinc-700"
          )}
        >
          {/* Left Column - Owner info */}
          <div
            className={cn(
              "flex-1 px-4 py-2 min-w-0",
              neynarUser?.user?.fid && "cursor-pointer hover:opacity-80 transition-opacity"
            )}
            onClick={neynarUser?.user?.fid ? handleViewKingGlazerProfile : undefined}
          >
            <div className="text-xs text-zinc-400 mb-1">
              Owner <span className="text-zinc-500">· {formatElapsedTime(elapsedSeconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage
                  src={occupantDisplay.avatarUrl || undefined}
                  alt={occupantDisplay.primary}
                  className="object-cover"
                />
                <AvatarFallback className="bg-zinc-600 text-white text-xs font-bold uppercase">
                  {rigState ? (
                    occupantFallbackInitials
                  ) : (
                    <CircleUserRound className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {occupantDisplay.primary}
                </div>
                {occupantDisplay.secondary && (
                  <div className="text-xs text-zinc-400 truncate">
                    {occupantDisplay.secondary}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="px-4 py-2 flex flex-col justify-center">
            <div className="grid grid-cols-[auto_auto] gap-x-2 gap-y-0 items-center">
              <div className="text-xs text-zinc-400 text-right">Mined</div>
              <div className="text-sm font-bold text-white text-right flex items-center justify-end gap-1">
                +<CoreIcon size={10} />{interpolatedMined !== null ? formatTokenAmount(interpolatedMined, CORE_DECIMALS, 0) : "0"}
              </div>
              <div className="text-xs text-zinc-400 text-right">PNL</div>
              <div className="text-sm font-bold text-white text-right">
                {pnlEth >= 0n ? "+" : "-"}Ξ{formatEth(pnlEth >= 0n ? pnlEth : -pnlEth, 5)}
              </div>
              <div className="text-xs text-zinc-400 text-right">Total</div>
              <div className={cn(
                "text-sm font-bold text-right",
                totalIsPositive ? "text-emerald-400" : "text-red-400"
              )}>
                {totalIsPositive ? "+" : "-"}${Math.abs(parseFloat(totalUsdValue)).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Grid - THE STAR - edge to edge */}
        <div className="flex-1 w-full">
          <WorldMap
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            onHoverIndex={setHoveredIndex}
            territories={allSlots}
            ownedIndices={ownedSlotIndices}
            territoryOwnerPfps={territoryOwnerPfps}
            ripple={ripple}
            previewColor={selectedColor}
          />
        </div>

        {/* Stats Row - two solid blocks side by side */}
        <div className="flex">
          <div className="flex-1 px-4 py-2 bg-zinc-800">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                Mining Rate
              </div>
              {(() => {
                const mult = slotState && slotState.multiplier > 0n
                  ? Number(slotState.multiplier) / 1e18
                  : 1;
                // Color based on multiplier: 1x = zinc, 2-3x = blue, 4-6x = purple, 7-9x = orange, 10x = gold/fire
                const getMultiplierStyle = () => {
                  if (mult >= 10) return "text-yellow-400 animate-pulse font-black";
                  if (mult >= 7) return "text-orange-400 font-bold";
                  if (mult >= 4) return "text-purple-400 font-bold";
                  if (mult >= 2) return "text-blue-400 font-semibold";
                  return "text-zinc-400";
                };
                return (
                  <div className={`text-sm ${getMultiplierStyle()}`}>
                    {mult >= 10 ? "🔥 " : ""}{mult.toFixed(0)}x{mult >= 10 ? " 🔥" : ""}
                  </div>
                );
              })()}
            </div>
            <div className="text-xl font-bold text-white flex items-center gap-1">
              <CoreIcon size={16} />{glazeRateDisplay}<span className="text-sm text-zinc-400">/s</span>
            </div>
            <div className="text-xs text-zinc-500">
              ${glazeRateUsdValue}/s
            </div>
          </div>
          <div className="flex-1 px-4 py-2 bg-zinc-700">
            <div className="text-xs text-zinc-400">
              Mining Price
            </div>
            <div className="text-xl font-bold text-white">
              {glazePriceDisplay}
            </div>
            <div className="text-xs text-zinc-500">
              ${slotState ? (Number(formatEther(slotState.price)) * ethUsdPrice).toFixed(2) : "0.00"}
            </div>
          </div>
        </div>

        {/* Action Row - color picker + button */}
        <div className="bg-zinc-950">
          <TilePlacer
            selectedColor={selectedColor}
            onColorSelect={setSelectedColor}
            onClearColor={() => setSelectedColor(null)}
            onPlace={handleGlaze}
            disabled={!slotState || isWriting || isConfirming || glazeResult !== null}
            isPlacing={isWriting || isConfirming}
          />
        </div>

        {/* Nav spacer - for fixed bottom nav */}
        <div className="h-14 bg-zinc-950 flex-shrink-0" />
      </div>
      <NavBar />
    </main>
  );
}
