import { WorkspaceHome } from '@features/workspace/components/workspace-home'

export function AppShell() {
  return (
    <main className="min-h-screen bg-app-shell px-6 py-10 text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <WorkspaceHome />
      </div>
    </main>
  )
}
