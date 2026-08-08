import type { Meta, StoryObj } from '@storybook/react'

import { Ellipsis } from '../../../src/components'

const meta = {
  title: 'Components/Composites/ellipsis',
  component: Ellipsis,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: ''
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    maxLine: {
      control: { type: 'number' },
      description: '111'
    },
    className: {
      control: { type: 'text' },
      description: ' CSS '
    },
    children: {
      control: { type: 'text' },
      description: ''
    }
  },
  args: {
    children: ''
  }
} satisfies Meta<typeof Ellipsis>

export default meta
type Story = StoryObj<typeof meta>

// 
export const Default: Story = {
  args: {
    maxLine: 1
  },
  render: (args) => (
    <div className="w-60 p-4 border border-gray-200 dark:border-gray-700 rounded">
      <Ellipsis {...args} />
    </div>
  )
}

// 
export const MultiLine: Story = {
  args: {
    maxLine: 3,
    children:
      ''
  },
  render: (args) => (
    <div className="w-80 p-4 border border-gray-200 dark:border-gray-700 rounded">
      <Ellipsis {...args} />
    </div>
  )
}

// 
export const DifferentMaxLines: Story = {
  render: () => (
    <div className="space-y-4 max-w-lg">
      <div>
        <h3 className="text-sm font-medium mb-2"> (maxLine = 1)</h3>
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={1}></Ellipsis>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2"> (maxLine = 2)</h3>
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={2}>
            
          </Ellipsis>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2"> (maxLine = 3)</h3>
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={3}>
            
          </Ellipsis>
        </div>
      </div>
    </div>
  )
}

// 
export const ShortText: Story = {
  args: {
    maxLine: 2,
    children: ''
  },
  render: (args) => (
    <div className="w-80 p-4 border border-gray-200 dark:border-gray-700 rounded">
      <Ellipsis {...args} />
    </div>
  )
}

// 
export const CustomStyle: Story = {
  args: {
    maxLine: 2,
    className: 'text-blue-600 font-medium text-lg',
    children: ''
  },
  render: (args) => (
    <div className="w-80 p-4 border border-gray-200 dark:border-gray-700 rounded">
      <Ellipsis {...args} />
    </div>
  )
}

// 
export const ResponsiveWidth: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2"> (200px)</h3>
        <div className="w-50 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={2}></Ellipsis>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2"> (300px)</h3>
        <div className="w-75 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={2}></Ellipsis>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2"> (400px)</h3>
        <div className="w-100 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <Ellipsis maxLine={2}></Ellipsis>
        </div>
      </div>
    </div>
  )
}

// HTML
export const WithHTMLContent: Story = {
  args: {
    maxLine: 2
  },
  render: (args) => (
    <div className="w-80 p-4 border border-gray-200 dark:border-gray-700 rounded">
      <Ellipsis {...args}>
        <span className="text-red-500"></span><strong className="font-bold"></strong>
        
        <em className="italic"></em>
        HTML
      </Ellipsis>
    </div>
  )
}
