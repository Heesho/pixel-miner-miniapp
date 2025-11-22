"use client";

import { useState, useEffect } from "react";
import { zeroAddress } from "viem";
import { formatEther, formatUnits } from "viem";

// Generate 256 pixels for 16x16 grid
const PIXELS = Array.from({ length: 256 }, (_, i) => ({ id: i }));

type SlotState = {
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  price: bigint;
  multiplier: bigint;
  pps: bigint;
  multiplierTime: bigint;
  mined: bigint;
  miner: string;
  color: string;
};

type WorldMapProps = {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onHoverIndex: (index: number | null) => void;
  territories: Array<SlotState>;
  ownedIndices: Set<number>;
  territoryOwnerPfps: Map<number, string>;
  animatingSlots?: {
    priceJump: Set<number>;
    multiplierChange: Set<number>;
  };
  previewColor?: string | null;
};

export function WorldMap({
  selectedIndex,
  onSelectIndex,
  onHoverIndex,
  territories,
  ownedIndices,
  animatingSlots,
  previewColor,
}: WorldMapProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseEnter = (id: number) => {
    setHoveredIndex(id);
    onHoverIndex(id);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    onHoverIndex(null);
  };

  const handleClick = (id: number) => {
    onSelectIndex(id);
  };

  const formatTimeRemaining = (multiplierTime: bigint): string => {
    const targetTime = Number(multiplierTime) * 1000; // Convert to milliseconds
    const remaining = Math.max(0, targetTime - currentTime);
    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatMultiplier = (multiplier: bigint): string => {
    const value = Number(formatUnits(multiplier, 18));
    return `×${value.toFixed(1)}`;
  };

  const formatPrice = (price: bigint): string => {
    const eth = parseFloat(formatEther(price));
    if (eth === 0) return "Ξ0";
    return `Ξ${eth.toFixed(5)}`;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div className="w-full aspect-square grid grid-cols-16">
        {PIXELS.map((pixel) => {
          const territory = territories[pixel.id];
          const isHovered = hoveredIndex === pixel.id;
          const isSelected = selectedIndex === pixel.id;
          const isOwned = ownedIndices.has(pixel.id);
          const hasOwner = territory && territory.miner && territory.miner !== zeroAddress;
          const isPriceJumping = animatingSlots?.priceJump.has(pixel.id) ?? false;
          const isMultiplierChanging = animatingSlots?.multiplierChange.has(pixel.id) ?? false;

          // Use the pixel's color if it has been mined, otherwise dark gray
          let bgColor = "#1a1a1a";
          if (hasOwner && territory.color && /^#[0-9A-F]{6}$/i.test(territory.color)) {
            bgColor = territory.color;
          }

          // Show preview color if this pixel is selected and a color is chosen
          const showPreview = isSelected && previewColor;
          const displayColor = showPreview ? previewColor : bgColor;

          return (
            <button
              key={pixel.id}
              className={`aspect-square relative ${
                isPriceJumping ? "animate-box-price-jump" : ""
              } ${isMultiplierChanging ? "animate-multiplier-change" : ""} ${
                showPreview ? "ring-2 ring-white ring-inset z-10" : ""
              }`}
              style={{
                backgroundColor: displayColor,
              }}
              onMouseEnter={() => handleMouseEnter(pixel.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(pixel.id)}
              title={`Pixel #${pixel.id}`}
            >
              {isOwned && !showPreview && (
                <div className="absolute inset-0 bg-white/10" />
              )}
              {isSelected && !previewColor && (
                <>
                  {/* Top-left corner */}
                  <div className="absolute top-0 left-0 w-[25%] h-[25%] border-t-2 border-l-2 border-white" />
                  {/* Top-right corner */}
                  <div className="absolute top-0 right-0 w-[25%] h-[25%] border-t-2 border-r-2 border-white" />
                  {/* Bottom-left corner */}
                  <div className="absolute bottom-0 left-0 w-[25%] h-[25%] border-b-2 border-l-2 border-white" />
                  {/* Bottom-right corner */}
                  <div className="absolute bottom-0 right-0 w-[25%] h-[25%] border-b-2 border-r-2 border-white" />
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { PIXELS };
