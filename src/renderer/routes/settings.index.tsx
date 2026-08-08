import { createFileRoute, redirect } from '@tanstack/react-router'

// /settings/  /settings/provider
export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/provider' })
  }
})
