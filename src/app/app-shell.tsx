import { WorkspaceHome } from '@features/workspace/components/workspace-home';

export function AppShell() {
  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <WorkspaceHome />
    </main>
  );
}
