"use client";

import { useState, useEffect } from "react";
import { zeroAddress } from "viem";
import { formatEther, formatUnits } from "viem";

const RISK_REGIONS = [
  { id: 0, name: "Alaska" },
  { id: 1, name: "Northwest Territory" },
  { id: 2, name: "Greenland" },
  { id: 3, name: "Alberta" },
  { id: 4, name: "Ontario" },
  { id: 5, name: "Quebec" },
  { id: 6, name: "Western United States" },
  { id: 7, name: "Eastern United States" },
  { id: 8, name: "Central America" },
  { id: 9, name: "Venezuela" },
  { id: 10, name: "Peru" },
  { id: 11, name: "Brazil" },
  { id: 12, name: "Argentina" },
  { id: 13, name: "Iceland" },
  { id: 14, name: "Great Britain" },
  { id: 15, name: "Scandinavia" },
  { id: 16, name: "Northern Europe" },
  { id: 17, name: "Western Europe" },
  { id: 18, name: "Southern Europe" },
  { id: 19, name: "Ukraine" },
  { id: 20, name: "North Africa" },
  { id: 21, name: "Egypt" },
  { id: 22, name: "East Africa" },
  { id: 23, name: "Congo" },
  { id: 24, name: "South Africa" },
  { id: 25, name: "Madagascar" },
  { id: 26, name: "Ural" },
  { id: 27, name: "Siberia" },
  { id: 28, name: "Yakutsk" },
  { id: 29, name: "Kamchatka" },
  { id: 30, name: "Irkutsk" },
  { id: 31, name: "Mongolia" },
  { id: 32, name: "Japan" },
  { id: 33, name: "Afghanistan" },
  { id: 34, name: "China" },
  { id: 35, name: "Middle East" },
  { id: 36, name: "India" },
  { id: 37, name: "Siam" },
  { id: 38, name: "Indonesia" },
  { id: 39, name: "New Guinea" },
  { id: 40, name: "Western Australia" },
  { id: 41, name: "Eastern Australia" },
];

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
};

export function WorldMap({
  selectedIndex,
  onSelectIndex,
  onHoverIndex,
  territories,
  ownedIndices,
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
    if (eth < 0.0001) return `Ξ${eth.toExponential(1)}`;
    if (eth < 1) return `Ξ${eth.toFixed(4)}`;
    return `Ξ${eth.toFixed(2)}`;
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full aspect-square grid grid-cols-4 grid-rows-4 gap-2 p-2">
        {RISK_REGIONS.slice(0, 16).map((region) => {
          const territory = territories[region.id];
          const isHovered = hoveredIndex === region.id;
          const isSelected = selectedIndex === region.id;
          const hasOwner = territory && territory.miner && territory.miner !== zeroAddress;

          let bgColor = "transparent";
          if (hasOwner) {
            bgColor = territory.color && territory.color !== "#3f3f46" && territory.color !== "#2d3748" && territory.color !== ""
              ? territory.color
              : "#00ff88";
          }

          let borderColor = "#3f3f46";
          if (isHovered) {
            borderColor = "#ffffff";
          } else if (isSelected) {
            borderColor = "#22d3ee";
          } else if (hasOwner) {
            borderColor = "#6b7280";
          }

          return (
            <div
              key={region.id}
              className="w-full h-full rounded border-2 cursor-pointer transition-all relative p-1.5"
              style={{
                backgroundColor: bgColor,
                borderColor: borderColor,
              }}
              onMouseEnter={() => handleMouseEnter(region.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(region.id)}
            >
              {/* Top-left: Box number */}
              <div className="absolute top-1.5 left-1.5 text-[10px] text-gray-400 font-medium">
                #{region.id + 1}
              </div>

              {/* Top-right: Multiplier */}
              {territory && (
                <div className="absolute top-1.5 right-1.5 text-[10px] text-gray-400">
                  {formatMultiplier(territory.multiplier)}
                </div>
              )}

              {/* Bottom-right: Price (large) */}
              {territory && (
                <div className="absolute bottom-1.5 right-1.5 text-white text-[18px] font-semibold">
                  {formatPrice(territory.price)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { RISK_REGIONS };
