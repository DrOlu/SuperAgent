import { Tooltip } from '@cherrystudio/ui'
import type { ActionTool } from '@renderer/components/ActionTools'
import { EllipsisVertical } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import CodeToolButton from './CodeToolButton'
import { ToolWrapper } from './styles'

const CodeToolbar = ({ tools }: { tools: ActionTool[] }) => {
  const [showQuickTools, setShowQuickTools] = useState(false)
  const { t } = useTranslation()

  // 
  const visibleTools = tools.filter((tool) => !tool.visible || tool.visible())

  // 
  const coreTools = visibleTools.filter((tool) => tool.type === 'core')
  const quickTools = visibleTools.filter((tool) => tool.type === 'quick')

  //  more 
  const quickToolButtons = useMemo(() => {
    if (quickTools.length === 1 || (quickTools.length > 1 && showQuickTools)) {
      return quickTools.map((tool) => <CodeToolButton key={tool.id} tool={tool} />)
    }

    return null
  }, [quickTools, showQuickTools])

  if (visibleTools.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none sticky top-7 z-10 h-0">
      <div className="code-toolbar pointer-events-auto absolute right-2 bottom-1 flex h-6 items-center gap-1">
        {/*  more  */}
        {quickToolButtons}
        {quickTools.length > 1 && (
          <Tooltip content={t('code_block.more')} delay={500}>
            <ToolWrapper
              onClick={() => setShowQuickTools(!showQuickTools)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowQuickTools(!showQuickTools)
                }
              }}
              className={showQuickTools ? 'active' : ''}
              role="button"
              aria-label={t('code_block.more')}
              aria-expanded={showQuickTools}
              tabIndex={0}>
              <EllipsisVertical className="tool-icon" />
            </ToolWrapper>
          </Tooltip>
        )}

        {/*  */}
        {coreTools.map((tool) => (
          <CodeToolButton key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  )
}

export default memo(CodeToolbar)
