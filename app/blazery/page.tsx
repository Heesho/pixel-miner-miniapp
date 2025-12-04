"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  useSimulateContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address, maxUint256 } from "viem";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONTRACT_ADDRESSES, MULTICALL_ABI } from "@/lib/contracts";
import { cn, getEthPrice } from "@/lib/utils";
import { NavBar } from "@/components/nav-bar";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type AuctionState = {
  epochId: bigint | number;
  initPrice: bigint;
  startTime: bigint | number;
  paymentToken: Address;
  price: bigint;
  paymentTokenPrice: bigint;
  wethAccumulated: bigint;
  wethBalance: bigint;
  paymentTokenBalance: bigint;
};

const DEADLINE_BUFFER_SECONDS = 5 * 60;
const LP_TOKEN_ADDRESS = "0xD1DbB2E56533C55C3A637D13C53aeEf65c5D5703" as Address;

const toBigInt = (value: bigint | number) =>
  typeof value === "bigint" ? value : BigInt(value);

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

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

export default function BlazeryPage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);
  const [blazeResult, setBlazeResult] = useState<"success" | "failure" | null>(
    null,
  );
  const [txStep, setTxStep] = useState<"idle" | "approving" | "buying">("idle");
  const blazeResultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const resetBlazeResult = useCallback(() => {
    if (blazeResultTimeoutRef.current) {
      clearTimeout(blazeResultTimeoutRef.current);
      blazeResultTimeoutRef.current = null;
    }
    setBlazeResult(null);
  }, []);

  const showBlazeResult = useCallback(
    (result: "success" | "failure") => {
      if (blazeResultTimeoutRef.current) {
        clearTimeout(blazeResultTimeoutRef.current);
      }
      setBlazeResult(result);
      blazeResultTimeoutRef.current = setTimeout(() => {
        setBlazeResult(null);
        blazeResultTimeoutRef.current = null;
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

  useEffect(() => {
    return () => {
      if (blazeResultTimeoutRef.current) {
        clearTimeout(blazeResultTimeoutRef.current);
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
    }).catch(() => {});
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  const { data: rawAuctionState, refetch: refetchAuctionState } =
    useReadContract({
      address: CONTRACT_ADDRESSES.multicall,
      abi: MULTICALL_ABI,
      functionName: "getAuction",
      args: [address ?? zeroAddress],
      chainId: base.id,
      query: {
        refetchInterval: 12_000,
      },
    });

  const auctionState = useMemo(() => {
    if (!rawAuctionState) return undefined;
    return rawAuctionState as unknown as AuctionState;
  }, [rawAuctionState]);

  const ERC20_ABI = [
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" },
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function",
    },
  ] as const;

  useEffect(() => {
    if (!readyRef.current && auctionState) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, [auctionState]);

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({
      hash: txHash,
      chainId: base.id,
    });

  const handleBlaze = useCallback(async () => {
    if (!auctionState) return;
    resetBlazeResult();
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

      const price = auctionState.price;
      const epochId = toBigInt(auctionState.epochId);
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS,
      );
      const maxPaymentTokenAmount = price;

      // If we're in idle or approval failed, start with approval
      if (txStep === "idle") {
        setTxStep("approving");
        await writeContract({
          account: targetAddress as Address,
          address: LP_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CONTRACT_ADDRESSES.multicall as Address, price],
          chainId: base.id,
        });
        return;
      }

      // If approval succeeded, now call buy
      if (txStep === "buying") {
        await writeContract({
          account: targetAddress as Address,
          address: CONTRACT_ADDRESSES.multicall as Address,
          abi: MULTICALL_ABI,
          functionName: "buy",
          args: [epochId, deadline, maxPaymentTokenAmount],
          chainId: base.id,
        });
      }
    } catch (error) {
      console.error("Failed to blaze:", error);
      showBlazeResult("failure");
      setTxStep("idle");
      resetWrite();
    }
  }, [
    address,
    connectAsync,
    auctionState,
    primaryConnector,
    resetBlazeResult,
    resetWrite,
    showBlazeResult,
    writeContract,
    txStep,
  ]);

  useEffect(() => {
    if (!receipt) return;
    if (receipt.status === "success" || receipt.status === "reverted") {
      if (receipt.status === "reverted") {
        showBlazeResult("failure");
        setTxStep("idle");
        refetchAuctionState();
        const resetTimer = setTimeout(() => {
          resetWrite();
        }, 500);
        return () => clearTimeout(resetTimer);
      }

      // If approval succeeded, now call buy
      if (txStep === "approving") {
        resetWrite();
        setTxStep("buying");
        return;
      }

      // If buy succeeded
      if (txStep === "buying") {
        showBlazeResult("success");
        setTxStep("idle");
        refetchAuctionState();
        const resetTimer = setTimeout(() => {
          resetWrite();
        }, 500);
        return () => clearTimeout(resetTimer);
      }
    }
    return;
  }, [receipt, refetchAuctionState, resetWrite, showBlazeResult, txStep]);

  // Auto-trigger buy after approval
  useEffect(() => {
    if (txStep === "buying" && !isWriting && !isConfirming && !txHash) {
      handleBlaze();
    }
  }, [txStep, isWriting, isConfirming, txHash, handleBlaze]);

  const auctionPriceDisplay = auctionState
    ? formatEth(auctionState.price, auctionState.price === 0n ? 0 : 5)
    : "—";

  const claimableDisplay = auctionState
    ? formatEth(auctionState.wethAccumulated, 8)
    : "—";

  const buttonLabel = useMemo(() => {
    if (!auctionState) return "Loading…";
    if (blazeResult === "success") return "SUCCESS";
    if (blazeResult === "failure") return "FAILURE";
    if (isWriting || isConfirming) {
      if (txStep === "approving") return "APPROVING…";
      if (txStep === "buying") return "BLAZING…";
      return "PROCESSING…";
    }
    return "BLAZE";
  }, [blazeResult, isConfirming, isWriting, auctionState, txStep]);

  const hasInsufficientLP = auctionState && auctionState.paymentTokenBalance < auctionState.price;

  // Calculate profit/loss for blazing
  const blazeProfitLoss = useMemo(() => {
    if (!auctionState) return null;

    // LP token value in USD
    const lpValueInEth = Number(formatEther(auctionState.price)) * Number(formatEther(auctionState.paymentTokenPrice));
    const lpValueInUsd = lpValueInEth * ethUsdPrice;

    // WETH value in USD
    const wethReceivedInEth = Number(formatEther(auctionState.wethAccumulated));
    const wethValueInUsd = wethReceivedInEth * ethUsdPrice;

    const profitLoss = wethValueInUsd - lpValueInUsd;
    const isProfitable = profitLoss > 0;

    return {
      profitLoss,
      isProfitable,
      lpValueInUsd,
      wethValueInUsd,
    };
  }, [auctionState, ethUsdPrice]);

  const isBlazeDisabled =
    !auctionState || isWriting || isConfirming || blazeResult !== null || hasInsufficientLP;

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
          <h1 className="text-2xl font-bold tracking-wide">Blazery</h1>
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
        <div className="flex-1 flex flex-col">
          <div className="flex">
            <div className="flex-1 bg-zinc-800 px-4 py-3">
              <div className="text-xs text-zinc-400 mb-1">
                Pay
              </div>
              <div className="text-xl font-bold text-white">
                {auctionPriceDisplay} LP
              </div>
              <div className="text-xs text-zinc-500">
                $
                {auctionState
                  ? (
                      Number(formatEther(auctionState.price)) *
                      Number(formatEther(auctionState.paymentTokenPrice)) *
                      ethUsdPrice
                    ).toFixed(2)
                  : "0.00"}
              </div>
            </div>

            <div className="flex-1 bg-zinc-700 px-4 py-3">
              <div className="text-xs text-zinc-400 mb-1">
                Get
              </div>
              <div className="text-xl font-bold text-white">
                Ξ{claimableDisplay}
              </div>
              <div className="text-xs text-zinc-500">
                $
                {auctionState
                  ? (
                      Number(formatEther(auctionState.wethAccumulated)) * ethUsdPrice
                    ).toFixed(2)
                  : "0.00"}
              </div>
            </div>
          </div>

          <button
            className="w-full h-14 bg-zinc-950 hover:bg-zinc-900 text-lg font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
            onClick={handleBlaze}
            disabled={isBlazeDisabled}
          >
            {buttonLabel}
          </button>

          <div className="flex items-center justify-between px-4 py-2 bg-zinc-800">
            <div className="text-xs text-zinc-400">
              Available:{" "}
              <span className="text-white font-bold">
                {address && auctionState?.paymentTokenBalance
                  ? formatEth(auctionState.paymentTokenBalance, 4)
                  : "0"}
              </span>{" "}
              DONUT-ETH LP
            </div>
            <a
              href="https://app.uniswap.org/explore/pools/base/0xD1DbB2E56533C55C3A637D13C53aeEf65c5D5703"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white hover:text-zinc-300 font-bold transition-colors"
            >
              Get LP →
            </a>
          </div>

          {/* Profit/Loss Warning Message */}
          {blazeProfitLoss && (
            <div className={cn(
              "text-center text-sm font-bold px-4 py-3 bg-zinc-700",
              blazeProfitLoss.isProfitable ? "text-emerald-400" : "text-red-400"
            )}>
              {blazeProfitLoss.isProfitable ? (
                <>
                  Profitable! ${blazeProfitLoss.wethValueInUsd.toFixed(2)} WETH for ${blazeProfitLoss.lpValueInUsd.toFixed(2)} LP
                  ({blazeProfitLoss.profitLoss >= 0 ? '+' : ''}${blazeProfitLoss.profitLoss.toFixed(2)})
                </>
              ) : (
                <>
                  Unprofitable: ${blazeProfitLoss.wethValueInUsd.toFixed(2)} WETH for ${blazeProfitLoss.lpValueInUsd.toFixed(2)} LP
                  (${blazeProfitLoss.profitLoss.toFixed(2)})
                </>
              )}
            </div>
          )}
        </div>

        {/* Nav spacer */}
        <div className="h-14 bg-zinc-950 flex-shrink-0" />
      </div>
      <NavBar />
    </main>
  );
}
