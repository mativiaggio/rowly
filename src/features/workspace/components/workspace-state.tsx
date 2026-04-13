import type { ReactNode } from 'react'
import { AlertCircle, Database, RefreshCcw } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@lib/utils'

type WorkspaceStateProps = {
  title: string
  message: string
  tone?: 'default' | 'danger' | 'loading'
  action?: ReactNode
  compact?: boolean
}

export function WorkspaceState({
  title,
  message,
  tone = 'default',
  action,
  compact = false,
}: WorkspaceStateProps) {
  const icon =
    tone === 'loading' ? (
      <RefreshCcw className="animate-spin" />
    ) : tone === 'danger' ? (
      <AlertCircle />
    ) : (
      <Database />
    )

  return (
    <Card
      className={cn(
        'rowly-state-card',
        compact ? 'min-h-[136px]' : 'min-h-[240px]',
        tone === 'danger' && 'border-destructive/40'
      )}
    >
      <CardHeader className="items-center text-center">
        <div className="rowly-state-icon">{icon}</div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {action ? (
        <CardContent className="flex justify-center pt-0">{action}</CardContent>
      ) : null}
    </Card>
  )
}
