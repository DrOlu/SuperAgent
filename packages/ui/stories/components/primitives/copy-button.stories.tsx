import type { Meta, StoryObj } from '@storybook/react'

import { CopyButton } from '../../../src/components'

const meta: Meta<typeof CopyButton> = {
  title: 'Components/Primitives/CopyButton',
  component: CopyButton,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    tooltip: {
      control: 'text',
      description: ''
    },
    label: {
      control: 'text',
      description: ''
    },
    size: {
      control: { type: 'range', min: 10, max: 30, step: 1 },
      description: ''
    },
    className: {
      control: 'text',
      description: ' CSS '
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}

export const WithTooltip: Story = {
  args: {
    tooltip: ''
  }
}

export const WithLabel: Story = {
  args: {
    label: ''
  }
}

export const WithTooltipAndLabel: Story = {
  args: {
    tooltip: '',
    label: ''
  }
}

export const SmallSize: Story = {
  args: {
    size: 12,
    label: '',
    tooltip: ''
  }
}

export const LargeSize: Story = {
  args: {
    size: 20,
    label: '',
    tooltip: ''
  }
}

export const CustomStyle: Story = {
  args: {
    label: '',
    tooltip: '',
    className: 'bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border-2 border-blue-200 dark:border-blue-700'
  }
}

export const OnlyIcon: Story = {
  args: {
    tooltip: '',
    size: 16
  }
}

export const Interactive: Story = {
  args: {
    tooltip: '',
    label: ''
  },
  render: (args) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">:</h3>
        <div className="space-y-2">
          <div>
            <CopyButton {...args} onClick={() => alert('!')} />
          </div>
          <div>
            <CopyButton tooltip="" label="" className="opacity-50 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

export const MultipleButtons: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium mb-2">:</h3>
      <div className="flex flex-wrap gap-4">
        <CopyButton tooltip="" label="" size={14} />
        <CopyButton tooltip="" label="" size={14} />
        <CopyButton tooltip="" label="" size={14} />
        <CopyButton tooltip="JSON" label="JSON" size={14} />
      </div>
    </div>
  )
}
