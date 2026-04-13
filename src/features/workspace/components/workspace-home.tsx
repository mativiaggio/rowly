import { useEffect, useState } from 'react'
import { Database, Moon, Play, Sun, TableProperties } from 'lucide-react'

import type { AppInfo } from '@shared/contracts/system'
import { Button } from '@components/ui/button'
import { useTheme } from '@hooks/use-theme'
import { getRowlyBridge } from '@lib/rowly'
import { rendererLogger } from '@lib/logger'

export function WorkspaceHome() {
  const { resolvedTheme, setTheme } = useTheme()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    const loadAppInfo = async () => {
      const result = await getRowlyBridge().system.getAppInfo()

      if (!result.ok) {
        rendererLogger.warn('Unable to read app metadata.', {
          error: result.error,
        })
        return
      }

      setAppInfo(result.data)
    }

    void loadAppInfo()
  }, [])

  const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'

  return (
    <section className="overflow-hidden rounded-4xl border border-border bg-app-panel shadow-[0_24px_80px_var(--app-shadow)]">
      <div className="flex flex-col gap-8 px-8 py-10 md:px-10 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-app-panel-muted px-3 py-1 text-sm text-muted-foreground">
            <Database className="size-4" />
            Desktop SQL client for PostgreSQL
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void setTheme(nextTheme)
            }}
            className="aspect-square!"
            aria-label={
              resolvedTheme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
          >
            {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </div>

        <div className="flex max-w-3xl flex-col gap-4">
          <h1 className="font-heading text-4xl tracking-tight md:text-5xl">
            Rowly
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            Product-ready foundation for Electron, React, Tailwind, shadcn/ui,
            and typed IPC contracts. The database workflows arrive in the next
            implementation stages.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button>
            <Play data-icon="inline-start" />
            New connection
          </Button>
          <Button variant="outline">
            <TableProperties data-icon="inline-start" />
            Explore schema
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-3xl border border-border bg-app-panel-muted p-4">
            <p className="text-sm text-muted-foreground">Theme</p>
            <p className="mt-2 text-lg font-medium capitalize">
              {resolvedTheme}
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-app-panel-muted p-4">
            <p className="text-sm text-muted-foreground">Environment</p>
            <p className="mt-2 text-lg font-medium">
              {appInfo?.isPackaged ? 'Packaged app' : 'Development'}
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-app-panel-muted p-4">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="mt-2 text-lg font-medium">
              {appInfo?.version ?? 'Loading...'}
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}
