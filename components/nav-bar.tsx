"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Flame, Info } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="flex items-stretch max-w-[520px] mx-auto">
        <Link
          href="/blazery"
          className={cn(
            "flex-1 flex items-center justify-center py-4 transition-colors",
            pathname === "/blazery"
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          <Flame className="w-6 h-6" />
        </Link>

        <Link
          href="/"
          className={cn(
            "flex-1 flex items-center justify-center py-4 transition-colors",
            pathname === "/"
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          <div
            className={cn(
              "w-6 h-6 border-4",
              pathname === "/" ? "border-white" : "border-zinc-500"
            )}
          />
        </Link>

        <Link
          href="/about"
          className={cn(
            "flex-1 flex items-center justify-center py-4 transition-colors",
            pathname === "/about"
              ? "bg-zinc-700 text-white"
              : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          )}
        >
          <Info className="w-6 h-6" />
        </Link>
      </div>
    </nav>
  );
}
