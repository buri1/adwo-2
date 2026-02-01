"use client";

import { useCallback, useState } from "react";
import { Square, Loader2, AlertTriangle, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useOrchestratorStore } from "@/stores/orchestrator-store";

interface StopOrchestratorButtonProps {
  className?: string;
}

export function StopOrchestratorButton({ className }: StopOrchestratorButtonProps) {
  const { status, paneId, setStopping, setStopped, setError } =
    useOrchestratorStore();
  const [showForceStop, setShowForceStop] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleStop = useCallback(async (force: boolean = false) => {
    if (!paneId) {
      toast.error("No pane ID available");
      return;
    }

    setStopping();
    setDialogOpen(false);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), force ? 10000 : 5000);

      const response = await fetch("/api/orchestrator/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pane_id: paneId }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // Already stopped
          setStopped();
          toast.info("Orchestrator is already stopped");
          return;
        }
        throw new Error(data.error || "Failed to stop orchestrator");
      }

      setStopped();
      setShowForceStop(false);
      toast.success("Orchestrator stopped successfully");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Timeout - show force stop option
        setShowForceStop(true);
        setError("Orchestrator is unresponsive");
        toast.error("Orchestrator is unresponsive", {
          description: "Use Force Stop to terminate the session",
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to stop orchestrator";
      setError(message);
      toast.error("Failed to stop orchestrator", {
        description: message,
      });
    }
  }, [paneId, setStopping, setStopped, setError]);

  const handleForceStop = useCallback(async () => {
    if (!paneId) {
      toast.error("No pane ID available");
      return;
    }

    setStopping();

    try {
      // Force stop bypasses graceful shutdown
      const response = await fetch("/api/orchestrator/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pane_id: paneId, force: true }),
      });

      const data = await response.json();

      if (!response.ok && response.status !== 404) {
        throw new Error(data.error || "Failed to force stop orchestrator");
      }

      setStopped();
      setShowForceStop(false);
      toast.success("Orchestrator force stopped");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to force stop orchestrator";
      // Even on error, reset to stopped state as the pane might be gone
      setStopped();
      setShowForceStop(false);
      toast.warning("Orchestrator session cleared", {
        description: message,
      });
    }
  }, [paneId, setStopping, setStopped]);

  const isRunning = status === "running";
  const isStopping = status === "stopping";

  // Don't show button if orchestrator is not running
  if (!isRunning && !isStopping && !showForceStop) {
    return null;
  }

  // Show Force Stop button when orchestrator is unresponsive
  if (showForceStop) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 px-3 py-2 text-yellow-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Unresponsive</span>
          </div>
          <Button
            onClick={handleForceStop}
            variant="destructive"
            size="sm"
            disabled={isStopping}
          >
            {isStopping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Forcing...
              </>
            ) : (
              <>
                <Power className="h-4 w-4" />
                Force Stop
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isStopping}
          className={className}
          size="lg"
        >
          {isStopping ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Stopping...
            </>
          ) : (
            <>
              <Square className="h-4 w-4" />
              Stop Orchestrator
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop Orchestrator?</AlertDialogTitle>
          <AlertDialogDescription>
            This will gracefully stop the orchestrator session. Any ongoing
            workflows will be interrupted. You can restart the orchestrator
            at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleStop(false)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Stop Orchestrator
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
