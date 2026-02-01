"use client";

import { useCallback, useEffect } from "react";
import { Play, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOrchestratorStore } from "@/stores/orchestrator-store";

interface StartOrchestratorButtonProps {
  className?: string;
}

export function StartOrchestratorButton({ className }: StartOrchestratorButtonProps) {
  const { status, isLoading, setStarting, setRunning, setError, setStopped } =
    useOrchestratorStore();

  // Fetch initial status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/orchestrator/status");
        const data = await response.json();

        if (data.isRunning) {
          setRunning(data.paneId, data.startedAt);
        } else {
          setStopped();
        }
      } catch {
        // Silently fail on initial status check
        setStopped();
      }
    }

    fetchStatus();
  }, [setRunning, setStopped]);

  const handleStart = useCallback(async () => {
    setStarting();

    try {
      const response = await fetch("/api/orchestrator/start", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Already running
          setRunning(data.pane_id, new Date().toISOString());
          toast.info("Orchestrator is already running");
          return;
        }
        throw new Error(data.error || "Failed to start orchestrator");
      }

      setRunning(data.pane_id, new Date().toISOString());
      toast.success("Orchestrator started successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start orchestrator";
      setError(message);
      toast.error("Failed to start orchestrator", {
        description: message,
      });
    }
  }, [setStarting, setRunning, setError]);

  const isRunning = status === "running";
  const isStarting = status === "starting" || isLoading;

  if (isRunning) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-4 py-2 text-green-500">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Orchestrator Running</span>
        </div>
      </div>
    );
  }

  return (
    <Button
      onClick={handleStart}
      disabled={isStarting}
      className={className}
      size="lg"
    >
      {isStarting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="h-4 w-4" />
          Start Orchestrator
        </>
      )}
    </Button>
  );
}
