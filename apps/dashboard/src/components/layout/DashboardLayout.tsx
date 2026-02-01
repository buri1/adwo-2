/**
 * ADWO 2.0 Dashboard Layout
 * Three-panel resizable layout with header.
 */

"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { LeftPanel } from "./LeftPanel";
import { CenterPanel } from "./CenterPanel";
import { RightPanel } from "./RightPanel";
import { Header } from "./Header";

export function DashboardLayout() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <Header />

      {/* Main content area with resizable panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full bg-gradient-to-br from-background via-background to-muted/20"
        >
          {/* Left Panel - Agents */}
          <ResizablePanel
            id="left"
            defaultSize="18%"
            minSize="12%"
            maxSize="30%"
            collapsible
            collapsedSize="0%"
          >
            <LeftPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Center Panel - Event Stream */}
          <ResizablePanel
            id="center"
            defaultSize="62%"
            minSize="40%"
          >
            <CenterPanel />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel - O-Agent Chat */}
          <ResizablePanel
            id="right"
            defaultSize="20%"
            minSize="15%"
            maxSize="40%"
            collapsible
            collapsedSize="0%"
          >
            <RightPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
