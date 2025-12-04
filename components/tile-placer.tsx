"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// r/place inspired color palette (24 colors - 2 rows of 12)
const COLOR_PALETTE = [
  "#6D001A", "#BE0039", "#FF4500", "#FFA800",
  "#FFD635", "#00A368", "#00CC78", "#7EED56",
  "#009EAA", "#2450A4", "#3690EA", "#51E9F4",
  "#493AC1", "#6A5CFF", "#811E9F", "#B44AC0",
  "#DE107F", "#FF3881", "#6D482F", "#000000",
  "#515252", "#898D90", "#D4D7D9", "#FFFFFF",
];

type TilePlacerProps = {
  selectedColor: string | null;
  onColorSelect: (color: string) => void;
  onClearColor: () => void;
  onPlace: () => void;
  disabled: boolean;
  isPlacing: boolean;
};

export function TilePlacer({
  selectedColor,
  onColorSelect,
  onClearColor,
  onPlace,
  disabled,
  isPlacing
}: TilePlacerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCancel = () => {
    setIsExpanded(false);
    onClearColor();
  };

  const handleConfirm = () => {
    if (selectedColor) {
      onPlace();
      setIsExpanded(false);
    }
  };

  const handleExpand = () => {
    if (!disabled) {
      setIsExpanded(true);
    }
  };

  // Fixed height for both states to prevent layout shift
  const containerHeight = "h-14";

  // Default state: Single button - bold, game-like
  if (!isExpanded) {
    return (
      <button
        className={`w-full ${containerHeight} bg-zinc-950 hover:bg-zinc-900 text-lg font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center`}
        onClick={handleExpand}
        disabled={disabled}
      >
        {isPlacing ? "Placing..." : "Place a Tile"}
      </button>
    );
  }

  // Expanded state: Color picker + X + Checkmark
  return (
    <div className={`flex items-stretch ${containerHeight}`}>
      {/* Color Picker - 2 rows of colors, no gaps */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-1">
          {COLOR_PALETTE.slice(0, 12).map((color) => (
            <button
              key={color}
              className={cn(
                "flex-1 transition-all",
                selectedColor === color
                  ? "ring-2 ring-white ring-inset scale-110 z-10"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onColorSelect(color)}
              title={color}
            />
          ))}
        </div>
        <div className="flex flex-1">
          {COLOR_PALETTE.slice(12, 24).map((color) => (
            <button
              key={color}
              className={cn(
                "flex-1 transition-all",
                selectedColor === color
                  ? "ring-2 ring-white ring-inset scale-110 z-10"
                  : "hover:scale-105"
              )}
              style={{ backgroundColor: color }}
              onClick={() => onColorSelect(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Cancel Button */}
      <button
        className="bg-zinc-800 hover:bg-zinc-700 w-14 flex items-center justify-center transition-colors flex-shrink-0"
        onClick={handleCancel}
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Confirm Button */}
      <button
        className={cn(
          "w-14 flex items-center justify-center transition-colors flex-shrink-0",
          selectedColor
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "bg-zinc-900 cursor-not-allowed opacity-40"
        )}
        onClick={handleConfirm}
        disabled={!selectedColor}
      >
        <Check className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
