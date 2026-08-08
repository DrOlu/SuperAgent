export type NotificationType = 'progress' | 'success' | 'error' | 'warning' | 'info' | 'action'
export type NotificationSource = 'assistant' | 'backup' | 'knowledge' | 'update'

export interface Notification<T = any> {
  /**  */
  id: string
  /**  */
  type: NotificationType
  /**  */
  title: string
  /**  */
  message: string
  /**  */
  timestamp: number
  /** 01 */
  progress?: number
  /** T  */
  meta?: T
  /**
   * /'action'  Electron IPC 
   *  action renderer  `notification.clicked` 
   *  actionKey 
   */
  actionKey?: string
  /** / */
  silent?: boolean
  /**  */
  source: NotificationSource
}
