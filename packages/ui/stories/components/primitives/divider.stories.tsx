import type { Meta, StoryObj } from '@storybook/react'

import { Divider } from '../../../src/components'

const meta: Meta<typeof Divider> = {
  title: 'Components/Primitives/Divider',
  component: Divider,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: ''
    },
    className: {
      control: 'text',
      description: ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  args: {
    orientation: 'horizontal'
  },
  render: (args) => (
    <div className="w-full">
      <p className="mb-2"></p>
      <Divider {...args} />
      <p className="mt-2"></p>
    </div>
  )
}

export const Vertical: Story = {
  args: {
    orientation: 'vertical'
  },
  render: (args) => (
    <div className="flex h-8 items-center">
      <span></span>
      <Divider {...args} />
      <span></span>
    </div>
  )
}

export const InSettingsContext: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <h3 className="text-lg font-medium"></h3>

      <div className="flex justify-between items-center">
        <span className="text-sm"></span>
        <span className="text-sm text-gray-500"></span>
      </div>

      <Divider />

      <div className="flex justify-between items-center">
        <span className="text-sm"></span>
        <span className="text-sm text-gray-500"></span>
      </div>

      <Divider />

      <div className="flex justify-between items-center">
        <span className="text-sm"></span>
        <span className="text-sm text-gray-500"></span>
      </div>
    </div>
  )
}

export const MultipleHorizontal: Story = {
  render: () => (
    <div className="space-y-2 max-w-md">
      <p></p>
      <Divider />
      <p></p>
      <Divider />
      <p></p>
      <Divider />
      <p></p>
    </div>
  )
}

export const VerticalInNavigation: Story = {
  render: () => (
    <div className="flex h-6 items-center gap-0">
      <a href="#" className="text-sm text-blue-600 hover:underline">
        
      </a>
      <Divider orientation="vertical" />
      <a href="#" className="text-sm text-blue-600 hover:underline">
        
      </a>
      <Divider orientation="vertical" />
      <a href="#" className="text-sm text-blue-600 hover:underline">
        
      </a>
      <Divider orientation="vertical" />
      <a href="#" className="text-sm text-blue-600 hover:underline">
        
      </a>
    </div>
  )
}

export const CustomStyle: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <div>
        <p className="text-sm text-gray-500 mb-2"></p>
        <Divider />
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2"></p>
        <Divider className="border-t-2" />
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2"></p>
        <Divider className="border-t-blue-500" />
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2"></p>
        <Divider className="border-dashed" />
      </div>

      <div>
        <p className="text-sm text-gray-500 mb-2"></p>
        <Divider className="my-6" />
      </div>
    </div>
  )
}

export const BothOrientations: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium mb-4"> (Horizontal)</h4>
        <div className="p-4 border rounded">
          <p></p>
          <Divider orientation="horizontal" />
          <p></p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-4"> (Vertical)</h4>
        <div className="p-4 border rounded flex items-center h-12">
          <span></span>
          <Divider orientation="vertical" />
          <span></span>
        </div>
      </div>
    </div>
  )
}
