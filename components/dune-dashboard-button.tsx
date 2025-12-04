"use client";

import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type DuneDashboardButtonProps = {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function DuneDashboardButton({
  className,
  variant = "default",
  size = "default",
}: DuneDashboardButtonProps) {
  const handleOpenDune = () => {
    window.open("https://dune.com/xyk/donut-company", "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleOpenDune}
      className={cn(
        "w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-white bg-zinc-700 hover:bg-zinc-600 transition-colors",
        className
      )}
    >
      <BarChart3 className="h-4 w-4" />
      <span>Analytics</span>
    </button>
  );
}
