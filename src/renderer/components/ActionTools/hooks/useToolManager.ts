import { useCallback } from 'react'

import type { ActionTool, ToolRegisterProps } from '../types'

export const useToolManager = (setTools?: ToolRegisterProps['setTools']) => {
  // ID
  const registerTool = useCallback(
    (tool: ActionTool) => {
      setTools?.((prev) => {
        const filtered = prev.filter((t) => t.id !== tool.id)
        return [...filtered, tool].sort((a, b) => b.order - a.order)
      })
    },
    [setTools]
  )

  // 
  const removeTool = useCallback(
    (id: string) => {
      setTools?.((prev) => prev.filter((tool) => tool.id !== id))
    },
    [setTools]
  )

  return { registerTool, removeTool }
}
