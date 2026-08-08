import McpSettings from '@renderer/pages/settings/McpSettings/McpSettingsPage'
import { createFileRoute } from '@tanstack/react-router'

// MCP McpSettings  Outlet 
export const Route = createFileRoute('/settings/mcp')({
  component: McpSettings
})
