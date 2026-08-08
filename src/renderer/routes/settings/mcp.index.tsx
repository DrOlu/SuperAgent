import { createFileRoute, redirect } from '@tanstack/react-router'

// /settings/mcp/  /settings/mcp/servers
export const Route = createFileRoute('/settings/mcp/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/mcp/servers' })
  }
})
