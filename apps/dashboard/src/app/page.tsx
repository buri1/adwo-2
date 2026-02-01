import { getConfig } from "@/lib/config";

export default async function HomePage() {
  const { config, source } = await getConfig();

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight">
          ADWO 2.0 Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Agent-Driven Workflow Orchestration
        </p>

        <div className="mt-8 rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">Configuration</h2>
          <dl className="mt-4 space-y-2">
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
    </main>
  );
}
