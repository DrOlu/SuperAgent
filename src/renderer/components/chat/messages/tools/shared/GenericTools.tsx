//  - 

import { Tooltip } from '@cherrystudio/ui'
import { SkeletonSpan } from '@renderer/components/Skeleton/InlineSkeleton'
import type { McpToolResponseStatus } from '@renderer/types/mcpTool'
import { formatFileSize } from '@renderer/utils/file'
import { Ellipsis, TriangleAlert } from 'lucide-react'
import { createContext, type ReactNode, use } from 'react'
import { useTranslation } from 'react-i18next'

export {
  getReadableToolActivity,
  getReadableToolDescription,
  type ToolActivity,
  default as ToolHeader,
  type ToolHeaderProps
} from '../ToolHeader'

// Streaming context - 
export const StreamingContext = createContext<boolean>(false)
export const useIsStreaming = () => use(StreamingContext)

export { SkeletonSpan }

/**
 * SkeletonValue -  skeleton
 */
export function SkeletonValue({
  value,
  width = '60px',
  fallback
}: {
  value: ReactNode
  width?: string
  fallback?: ReactNode
}) {
  const isStreaming = useIsStreaming()

  if (value !== undefined && value !== null && value !== '') {
    return <>{value}</>
  }

  if (isStreaming) {
    return <SkeletonSpan width={width} />
  }

  return <>{fallback ?? ''}</>
}

//  (Task, Bash, Search)
export function StringInputTool({
  input,
  label,
  className = ''
}: {
  input: string
  label: string
  className?: string
}) {
  return (
    <div className={className}>
      <div>{label}:</div>
      <div>{input}</div>
    </div>
  )
}

//  (pattern, query, file_path )
export function SimpleFieldInputTool({
  input,
  label,
  fieldName,
  className = ''
}: {
  input: Record<string, any>
  label: string
  fieldName: string
  className?: string
}) {
  return (
    <div className={className}>
      <div>{label}:</div>
      <div>
        <div>{input[fieldName]}</div>
        {/*  Grep  output_mode */}
        {Object.entries(input)
          .filter(([key]) => key !== fieldName)
          .map(([key, value]) => (
            <span key={key}>
              {key}: {String(value)}
            </span>
          ))}
      </div>
    </div>
  )
}

//  (Read, Bash, Search, Glob, WebSearch, Grep )
export function StringOutputTool({
  output,
  label,
  className = '',
  textColor = ''
}: {
  output: string
  label: string
  className?: string
  textColor?: string
}) {
  return (
    <div className={className}>
      <div className={textColor}>{label}:</div>
      <div>{output}</div>
    </div>
  )
}

// ToolStatus extends McpToolResponseStatus with UI-derived statuses
// 'waiting' is a UI status derived from 'pending' + needs approval
export type ToolStatus = McpToolResponseStatus | 'waiting'

/**
 * Convert raw data layer status to UI display status
 * @param status - Raw status from McpToolResponseStatus
 * @param isWaiting - Whether the tool is waiting for user approval
 * @returns The effective UI status
 */
export function getEffectiveStatus(status: McpToolResponseStatus | undefined, isWaiting: boolean): ToolStatus {
  if (status === 'pending') {
    return isWaiting ? 'waiting' : 'invoking'
  }
  return status ?? 'pending'
}

//  -  Collapse 
export function ToolStatusIndicator({
  status,
  hasError = false,
  errorText
}: {
  status: ToolStatus
  hasError?: boolean
  errorText?: string
}) {
  const { t } = useTranslation()

  const getStatusInfo = (): { label: string; icon?: ReactNode; color: StatusColor } | null => {
    switch (status) {
      case 'streaming':
        return { label: t('message.tools.streaming', 'Streaming'), color: 'primary' }
      case 'waiting':
        return { label: t('message.tools.pending', 'Awaiting Approval'), color: 'warning' }
      case 'pending':
      case 'invoking':
        return { label: t('message.tools.invoking'), color: 'primary' }
      case 'cancelled':
        return {
          label: t('message.tools.cancelled'),
          color: 'error'
        }
      case 'done':
        return hasError
          ? {
              label: t('message.tools.error'),
              icon: <TriangleAlert size={13} className="lucide-custom" />,
              color: 'error'
            }
          : {
              label: t('message.tools.completed'),
              color: 'success'
            }
      case 'error':
        return {
          label: t('message.tools.error'),
          icon: <TriangleAlert size={13} className="lucide-custom" />,
          color: 'error'
        }
      default:
        return null
    }
  }

  const info = getStatusInfo()
  if (!info) return null

  const indicator = (
    <StatusIndicatorContainer $color={info.color}>
      {info.icon}
      {info.label}
    </StatusIndicatorContainer>
  )

  if (!errorText || (status !== 'error' && !hasError)) return indicator

  return (
    <Tooltip
      content={<div className="max-w-96 whitespace-pre-wrap break-words">{errorText}</div>}
      delay={300}
      classNames={{ placeholder: 'inline-flex' }}>
      <span>{indicator}</span>
    </Tooltip>
  )
}

export type StatusColor = 'primary' | 'success' | 'warning' | 'error'

const TOOL_STATUS_ERROR_COLOR = 'var(--muted-foreground)'

function getStatusColor(color: StatusColor): string {
  switch (color) {
    case 'primary':
    case 'success':
      return 'var(--primary)'
    case 'warning':
      return 'var(--warning)'
    case 'error':
      return TOOL_STATUS_ERROR_COLOR
    default:
      return 'var(--foreground)'
  }
}

export function StatusIndicatorContainer({
  $color,
  style,
  ...props
}: React.ComponentPropsWithoutRef<'span'> & { $color: StatusColor }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs opacity-85"
      style={{ color: getStatusColor($color), ...style }}
      {...props}
    />
  )
}

export function TruncatedIndicator({ originalLength }: { originalLength: number }) {
  const { t } = useTranslation()
  const sizeStr = formatFileSize(originalLength)

  return (
    <div className="mt-2 flex items-center gap-1 text-muted-foreground text-xs">
      <Ellipsis size={14} />
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
        {t('message.tools.truncated', { defaultValue: sizeStr, size: sizeStr })}
      </span>
    </div>
  )
}
