/**
 * 
 */
export interface ActionToolSpec {
  id: string
  type: 'core' | 'quick'
  order: number
}

/**
 * 
 * @param id 
 * @param type 
 * @param order 
 * @param icon 
 * @param tooltip 
 * @param visible 
 * @param onClick 
 * @param children  more 
 */
export interface ActionTool extends ActionToolSpec {
  icon: React.ReactNode
  tooltip?: string
  visible?: () => boolean
  onClick?: () => void
  children?: Omit<ActionTool, 'children'>[]
}

/**
 *  props
 */
export interface ToolRegisterProps {
  setTools?: (value: React.SetStateAction<ActionTool[]>) => void
}
