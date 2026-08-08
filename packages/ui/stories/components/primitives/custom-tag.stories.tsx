import type { Meta, StoryObj } from '@storybook/react-vite'
import { AlertTriangleIcon, StarIcon } from 'lucide-react'
import { action } from 'storybook/actions'

import { CustomTag } from '../../../src/components'

const meta: Meta<typeof CustomTag> = {
  title: 'Components/Primitives/CustomTag',
  component: CustomTag,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    color: { control: 'color' },
    size: { control: { type: 'range', min: 8, max: 24, step: 1 } },
    disabled: { control: 'boolean' },
    inactive: { control: 'boolean' },
    closable: { control: 'boolean' },
    onClose: { action: 'closed' },
    onClick: { action: 'clicked' }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// 
export const Default: Story = {
  args: {
    children: '',
    color: '#1890ff'
  }
}

// 
export const WithIcon: Story = {
  args: {
    children: '',
    color: '#52c41a',
    icon: <StarIcon size={12} />
  }
}

// 
export const Closable: Story = {
  args: {
    children: '',
    color: '#fa8c16',
    closable: true,
    onClose: action('tag-closed')
  }
}

// 
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <CustomTag color="#1890ff" size={10}>
        
      </CustomTag>
      <CustomTag color="#1890ff" size={14}>
        
      </CustomTag>
      <CustomTag color="#1890ff" size={18}>
        
      </CustomTag>
    </div>
  )
}

// 
export const States: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <CustomTag color="#52c41a"></CustomTag>
        <CustomTag color="#52c41a" disabled>
          
        </CustomTag>
        <CustomTag color="#52c41a" inactive>
          
        </CustomTag>
      </div>
      <div className="flex gap-2">
        <CustomTag color="#1890ff" onClick={action('clicked')}>
          
        </CustomTag>
        <CustomTag color="#fa541c" tooltip="">
          
        </CustomTag>
      </div>
    </div>
  )
}

// 
export const UseCases: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2">:</h4>
        <div className="flex flex-wrap gap-2">
          <CustomTag color="#1890ff">React</CustomTag>
          <CustomTag color="#52c41a">TypeScript</CustomTag>
          <CustomTag color="#fa8c16">Tailwind</CustomTag>
        </div>
      </div>

      <div>
        <h4 className="mb-2">:</h4>
        <div className="flex gap-2">
          <CustomTag color="#52c41a" icon={<AlertTriangleIcon size={12} />}>
            
          </CustomTag>
          <CustomTag color="#fa541c" closable onClose={action('task-removed')}>
            
          </CustomTag>
        </div>
      </div>
    </div>
  )
}
