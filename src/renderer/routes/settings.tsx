import SettingsPage from '@renderer/pages/settings/SettingsPage'
import { createFileRoute } from '@tanstack/react-router'

// SettingsPage  Outlet 
export const Route = createFileRoute('/settings')({
  component: SettingsPage
})
