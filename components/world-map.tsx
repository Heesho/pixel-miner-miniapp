"use client";

import { useState, useMemo } from "react";
import { zeroAddress } from "viem";

// Generate 256 pixels for 16x16 grid
const PIXELS = Array.from({ length: 256 }, (_, i) => ({ id: i }));
const GRID_SIZE = 16;

type SlotState = {
  epochId: bigint;
  initPrice: bigint;
  startTime: bigint;
  price: bigint;
  ups: bigint;
  multiplier: bigint;
  multiplierTime: bigint;
  mined: bigint;
  miner: string;
  uri: string;
};

type WorldMapProps = {
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onHoverIndex: (index: number | null) => void;
  territories: Array<SlotState>;
  ownedIndices: Set<number>;
  territoryOwnerPfps: Map<number, string>;
  ripple: { sourceIndex: number; color: string } | null;
  previewColor?: string | null;
};

// Convert pixel index to row, col
const indexToCoords = (index: number) => ({
  row: Math.floor(index / GRID_SIZE),
  col: index % GRID_SIZE,
});

// Calculate distance between two pixels
const getDistance = (index1: number, index2: number): number => {
  const p1 = indexToCoords(index1);
  const p2 = indexToCoords(index2);
  // Use Chebyshev distance (max of row/col diff) for square ripple
  // Or Euclidean for circular ripple
  const rowDiff = Math.abs(p1.row - p2.row);
  const colDiff = Math.abs(p1.col - p2.col);
  // Chebyshev distance gives square ripple
  return Math.max(rowDiff, colDiff);
};

export function WorldMap({
  selectedIndex,
  onSelectIndex,
  onHoverIndex,
  territories,
  ownedIndices,
  ripple,
  previewColor,
}: WorldMapProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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

  // Pre-calculate ripple data for all pixels
  const rippleData = useMemo(() => {
    if (!ripple) return null;

    const data = new Map<number, { distance: number; delay: number }>();
    PIXELS.forEach((pixel) => {
      const distance = getDistance(pixel.id, ripple.sourceIndex);
      // 40ms delay per distance unit, max distance ~21 for 16x16 grid
      const delay = distance * 40;
      data.set(pixel.id, { distance, delay });
    });
    return data;
  }, [ripple]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950">
      <div className="w-full h-full grid grid-cols-16 grid-rows-16">
        {PIXELS.map((pixel) => {
          const territory = territories[pixel.id];
          const isSelected = selectedIndex === pixel.id;
          const isOwned = ownedIndices.has(pixel.id);
          const hasOwner = territory && territory.miner && territory.miner !== zeroAddress;

          // Get the base color from contract
          let bgColor = "#000000";
          if (hasOwner && territory.uri && /^#[0-9A-F]{6}$/i.test(territory.uri)) {
            bgColor = territory.uri;
          }

          // Show preview color if this pixel is selected and a color is chosen
          const showPreview = isSelected && previewColor;
          const displayColor = showPreview ? previewColor : bgColor;

          // Ripple animation
          const isRippling = ripple && rippleData;
          const isRippleSource = ripple && ripple.sourceIndex === pixel.id;
          const pixelRippleData = rippleData?.get(pixel.id);
          const rippleDelay = pixelRippleData?.delay ?? 0;

          // Determine animation class
          let animationClass = "";
          if (isRippleSource) {
            animationClass = "animate-ripple-source";
          } else if (isRippling && pixelRippleData) {
            animationClass = "animate-ripple";
          }

          return (
            <button
              key={isRippling ? `${pixel.id}-ripple-${ripple.sourceIndex}` : `${pixel.id}`}
              className={`pixel-cell relative ${animationClass} ${
                showPreview ? "ring-2 ring-white ring-inset z-10" : ""
              }`}
              style={{
                "--final-color": displayColor,
                "--ripple-color": ripple?.color ?? "#fff",
                animationDelay: isRippling && !isRippleSource ? `${rippleDelay}ms` : "0ms",
              } as React.CSSProperties}
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
                  <div className="absolute top-0 left-0 w-[25%] h-[25%] border-t-2 border-l-2 border-white" />
                  <div className="absolute top-0 right-0 w-[25%] h-[25%] border-t-2 border-r-2 border-white" />
                  <div className="absolute bottom-0 left-0 w-[25%] h-[25%] border-b-2 border-l-2 border-white" />
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
