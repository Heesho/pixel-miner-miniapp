"use client";

import { useCallback, useMemo } from "react";
import { formatEther, type Address, zeroAddress } from "viem";
import { cn } from "@/lib/utils";

type SlotState = {
  epochId: bigint | number;
  initPrice: bigint;
  startTime: bigint | number;
  price: bigint;
  ups: bigint;
  multiplier: bigint;
  multiplierTime: bigint;
  mined: bigint;
  miner: Address;
  uri: string;
};

type PixelGridProps = {
  slots: SlotState[];
  selectedIndex: number | null;
  onSelectPixel: (index: number) => void;
  userAddress?: Address;
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

export function PixelGrid({ slots, selectedIndex, onSelectPixel, userAddress }: PixelGridProps) {
  const getPixelColor = useCallback((slot: SlotState) => {
    if (!slot.uri || slot.uri.trim() === "") {
      return "#1a1a1a"; // dark gray for unmined
    }
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(slot.uri)) {
      return slot.uri;
    }
    return "#1a1a1a";
  }, []);

  const isOwnedByUser = useCallback((slot: SlotState) => {
    if (!userAddress || slot.miner === zeroAddress) return false;
    return slot.miner.toLowerCase() === userAddress.toLowerCase();
  }, [userAddress]);

  return (
    <div className="flex flex-col gap-4">
      {/* Grid */}
      <div
        className="grid gap-[2px] bg-zinc-900 p-[2px] rounded-lg"
        style={{
          gridTemplateColumns: "repeat(16, 1fr)",
        }}
      >
        {slots.map((slot, index) => {
          const isSelected = selectedIndex === index;
          const isOwned = isOwnedByUser(slot);
          const backgroundColor = getPixelColor(slot);

          return (
            <button
              key={index}
              onClick={() => onSelectPixel(index)}
              className={cn(
                "aspect-square relative transition-all duration-200",
                "hover:scale-110 hover:z-10 hover:shadow-lg",
                isSelected && "scale-110 z-10 ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/50",
                isOwned && "ring-1 ring-cyan-500/50"
              )}
              style={{
                backgroundColor,
              }}
              title={`Pixel #${index} - ${formatEth(slot.price, 5)} ETH`}
            >
              {isOwned && (
                <div className="absolute inset-0 bg-cyan-400/10" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Pixel Info */}
      {selectedIndex !== null && slots[selectedIndex] && (
        <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Pixel #{selectedIndex}
            </div>
            {isOwnedByUser(slots[selectedIndex]) && (
              <div className="text-xs font-bold uppercase tracking-wide text-cyan-400">
                You Own This
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-400">Price</div>
              <div className="font-semibold text-white">
                Ξ{formatEth(slots[selectedIndex].price, 5)}
              </div>
            </div>

            <div>
              <div className="text-gray-400">Mined</div>
              <div className="font-semibold text-white">
                {formatEth(slots[selectedIndex].mined, 2)} CORE
              </div>
            </div>

            <div>
              <div className="text-gray-400">Rate</div>
              <div className="font-semibold text-white">
                {formatEth(slots[selectedIndex].ups, 4)}/s
              </div>
            </div>

            <div>
              <div className="text-gray-400">Multiplier</div>
              <div className="font-semibold text-cyan-400">
                {Number(slots[selectedIndex].multiplier) / 1e18}x
              </div>
            </div>
          </div>

          {slots[selectedIndex].miner !== zeroAddress && (
            <div className="mt-2 pt-2 border-t border-zinc-800">
              <div className="text-gray-400 text-xs">Owner</div>
              <div className="font-mono text-xs text-white truncate">
                {slots[selectedIndex].miner.slice(0, 10)}...{slots[selectedIndex].miner.slice(-8)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
