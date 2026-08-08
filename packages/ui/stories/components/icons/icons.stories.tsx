import type { Meta, StoryObj } from '@storybook/react'

import { AddCategory, AiPrompt, CodeAi, MessageAi1 } from '../../../src/components/icons/general'

// Icon 
const icons = [
  { Component: AddCategory, name: 'AddCategory' },
  { Component: AiPrompt, name: 'AiPrompt' },
  { Component: CodeAi, name: 'CodeAi' },
  { Component: MessageAi1, name: 'MessageAi1' }
]

interface IconsShowcaseProps {
  fontSize?: number
}

const IconsShowcase = ({ fontSize = 32 }: IconsShowcaseProps) => {
  return (
    <div className="flex flex-wrap gap-4 p-2">
      {icons.map(({ Component, name }) => (
        <div key={name} className="flex flex-col items-center justify-center">
          <div
            className="w-min overflow-hidden rounded-md border-1 border-gray-200 p-2"
            key={name}
            style={{ fontSize }}>
            <Component />
          </div>
          <p className="text-sm text-center mt-2">{name}</p>
        </div>
      ))}
    </div>
  )
}

const meta: Meta<typeof IconsShowcase> = {
  title: 'Components/Icons/General',
  component: IconsShowcase,
  parameters: {
    layout: 'fullscreen'
  },
  tags: ['autodocs'],
  argTypes: {
    fontSize: {
      control: { type: 'number', min: 16, max: 64, step: 4 },
      description: 'Icon  fontSize  1em ',
      defaultValue: 32
    }
  }
}

export default meta
type Story = StoryObj<typeof IconsShowcase>

/**
 *  4 
 *
 *  SVGR  `icon: true` 
 * -  `width="1em"`  `height="1em"` `fontSize`
 * -  SVG clipPath 
 * -  SVG propsclassName, style, onClick 
 *
 * ## 
 *
 * ```tsx
 * import { CodeAi } from '@cherrystudio/ui/icons'
 *
 * //  fontSize 
 * <div style={{ fontSize: 24 }}>
 *   <CodeAi />
 * </div>
 *
 * //  className Tailwind
 * <CodeAi className="text-2xl" />
 *
 * //  SVG props
 * <CodeAi className="hover:opacity-80" onClick={handleClick} />
 * ```
 */
export const AllIcons: Story = {
  args: {
    fontSize: 32
  }
}
