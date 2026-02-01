# ADWO 2.0

**Agentic Development Workflow Orchestrator** - Real-time dashboard for monitoring and interacting with AI-powered development workflows.

## Architecture

```
CLI Orchestrator (Backend) + Dashboard (UI) = ADWO 2.0
                            ↑
                    Event Bridge (connection layer)
```

## Structure

```
adwo-2/
├── orchestrator/          # Git Submodule → github.com/buri1/orchestrator-template
├── apps/
│   └── dashboard/         # Next.js Dashboard + Event Bridge
├── packages/
│   └── shared/            # TypeScript Types
├── adwo.config.yaml       # Project configuration
└── pnpm-workspace.yaml    # Workspace definition
```

## Getting Started

```bash
# Clone with submodule
git clone --recurse-submodules https://github.com/buri1/adwo-2

# If already cloned without submodules
git submodule update --init --recursive

# Install dependencies
pnpm install

# Start dashboard + event bridge
pnpm dev
```

## Submodule Management

```bash
# Update orchestrator to latest version
git submodule update --remote orchestrator
git add orchestrator
git commit -m "Update orchestrator to latest"

# Work on orchestrator directly
cd orchestrator
# make changes...
git add . && git commit -m "Your change"
git push  # pushes to orchestrator-template repo
cd ..
git add orchestrator
git commit -m "Update orchestrator submodule ref"
git push  # pushes to adwo-2 repo
```

## License

MIT
