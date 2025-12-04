"use client";

import { useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Button } from "@/components/ui/button";
import { Plus, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AddToFarcasterButtonProps = {
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
};

export function AddToFarcasterButton({
  className,
  variant = "default",
  size = "default",
}: AddToFarcasterButtonProps) {
  const [status, setStatus] = useState<"idle" | "adding" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleAddToFarcaster = useCallback(async () => {
    try {
      setStatus("adding");
      setErrorMessage("");

      // Call the addMiniApp SDK action
      // If successful, returns { notificationDetails?: ... }
      // If rejected by user, throws RejectedByUser error
      await sdk.actions.addMiniApp();

      // If we get here, the app was successfully added
      setStatus("success");
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus("idle");
      }, 3000);
    } catch (error) {
      console.error("Failed to add Mini App:", error);

      // Check if user cancelled (this is expected behavior)
      const errorName = error instanceof Error ? error.name : "";
      if (errorName === "AddMiniApp.RejectedByUser") {
        // User cancelled - just reset to idle without showing error
        setStatus("idle");
        return;
      }

      setStatus("error");

      // Provide user-friendly error messages
      const errorMsg =
        error instanceof Error ? error.message : "Failed to add app";

      if (errorName === "AddMiniApp.InvalidDomainManifest" || errorMsg.includes("domain")) {
        setErrorMessage("App must be on production domain with valid manifest");
      } else if (errorMsg.includes("not supported")) {
        setErrorMessage("This feature is not available in your current environment");
      } else {
        setErrorMessage("Unable to add app. Please try again.");
      }

      // Reset to idle after 5 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 5000);
    }
  }, []);

  const buttonContent = () => {
    switch (status) {
      case "adding":
        return (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Adding...</span>
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            <span>Added!</span>
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            <span>Failed</span>
          </>
        );
      default:
        return (
          <>
            <Plus className="h-4 w-4" />
            <span>Add to Farcaster</span>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col">
      <button
        onClick={handleAddToFarcaster}
        disabled={status === "adding" || status === "success"}
        className={cn(
          "w-full h-12 flex items-center justify-center gap-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          status === "success" ? "bg-emerald-600" : status === "error" ? "bg-red-600" : "bg-zinc-900 hover:bg-zinc-800",
          className
        )}
      >
        {buttonContent()}
      </button>
      {status === "error" && errorMessage && (
        <p className="text-xs text-red-400 text-center px-2 py-1 bg-zinc-900">{errorMessage}</p>
      )}
    </div>
  );
}
