import { WorkspaceHome } from '@features/workspace/components/workspace-home'

export function AppShell() {
  return (
    <main className="min-h-screen bg-background px-6 py-6 text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <WorkspaceHome />
      </div>
    </main>
  )
}
