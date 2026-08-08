import type { NotesTreeNode } from '@renderer/types/note'
import { useMemo } from 'react'

// 
export const findNodeByPath = (tree: NotesTreeNode[], targetPath: string): NotesTreeNode | null => {
  for (const node of tree) {
    if (node.externalPath === targetPath) {
      return node
    }
    if (node.children) {
      const found = findNodeByPath(node.children, targetPath)
      if (found) return found
    }
  }
  return null
}

/**
 * 
 */
export function useActiveNode(notesTree: NotesTreeNode[], activeFilePath?: string) {
  const activeNode = useMemo(() => {
    if (!notesTree || !activeFilePath) return null
    return findNodeByPath(notesTree, activeFilePath)
  }, [notesTree, activeFilePath])

  return {
    activeNode,
    hasActiveFile: !!activeFilePath
  }
}
