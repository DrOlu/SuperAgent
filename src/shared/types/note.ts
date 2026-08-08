/**
 * @interface
 * @description 
 *
 * Cross-process: the main process builds `NotesTreeNode[]` from the filesystem
 * (knowledge directory source) and the renderer renders/manages the tree. This
 * is the UI tree shape — distinct from the DB-backed `Note` entity in
 * `@shared/data/types/note`.
 */
export interface NotesTreeNode {
  id: string
  name: string // 
  type: 'folder' | 'file' | 'hint'
  treePath: string // 
  externalPath: string // 
  children?: NotesTreeNode[]
  isStarred?: boolean
  expanded?: boolean
  createdAt: string
  updatedAt: string
}
