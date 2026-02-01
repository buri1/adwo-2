import { getConfig } from "@/lib/config";
import { EventStreamPanel } from "@/components/event-stream";
import { StartOrchestratorButton, StopOrchestratorButton } from "@/components/orchestrator";
import { QuestionPanel } from "@/components/question";
import { CostIndicator, CostPanel } from "@/components/cost";

export default async function HomePage() {
  const { config, source } = await getConfig();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              ADWO 2.0 Dashboard
            </h1>
            <p className="mt-2 text-muted-foreground">
              Agent-Driven Workflow Orchestration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CostIndicator warningThreshold={5.0} />
            <div className="flex items-center gap-2">
              <StartOrchestratorButton />
              <StopOrchestratorButton />
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Event Stream - Takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            <EventStreamPanel maxHeight="h-[calc(100vh-200px)]" />
          </div>

          {/* Sidebar with Questions, Cost and Config */}
          <div className="space-y-6">
            {/* Question Panel */}
            <QuestionPanel maxHeight="h-[calc(33vh-80px)]" />

            {/* Cost Panel */}
            <CostPanel
              warningThreshold={5.0}
              maxHeight="h-[calc(33vh-80px)]"
            />

            {/* Config Panel */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold">Configuration</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Project:</dt>
                  <dd className="font-mono">{config.project.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Version:</dt>
                  <dd className="font-mono">{config.version}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Source:</dt>
                  <dd className="font-mono">{source}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
