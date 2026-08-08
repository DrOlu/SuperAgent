import type { Meta, StoryObj } from '@storybook/react'

import { IndicatorLight } from '../../../src/components'

const meta: Meta<typeof IndicatorLight> = {
  title: 'Components/Primitives/IndicatorLight',
  component: IndicatorLight,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'color',
      description: ''
    },
    size: {
      control: { type: 'range', min: 4, max: 32, step: 2 },
      description: ''
    },
    shadow: {
      control: 'boolean',
      description: ''
    },
    style: {
      control: false,
      description: ''
    },
    animation: {
      control: 'boolean',
      description: ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    color: 'green'
  }
}

export const Red: Story = {
  args: {
    color: '#ef4444'
  }
}

export const Blue: Story = {
  args: {
    color: '#3b82f6'
  }
}

export const Yellow: Story = {
  args: {
    color: '#eab308'
  }
}

export const Purple: Story = {
  args: {
    color: '#a855f7'
  }
}

export const Orange: Story = {
  args: {
    color: '#f97316'
  }
}

export const WithoutShadow: Story = {
  args: {
    color: 'green',
    shadow: false
  }
}

export const WithoutAnimation: Story = {
  args: {
    color: '#3b82f6',
    animation: false
  }
}

export const SmallSize: Story = {
  args: {
    color: '#ef4444',
    size: 6
  }
}

export const LargeSize: Story = {
  args: {
    color: '#22c55e',
    size: 24
  }
}

export const CustomStyle: Story = {
  args: {
    color: '#8b5cf6',
    size: 16,
    style: {
      border: '2px solid #8b5cf6',
      opacity: 0.8
    },
    className: 'ring-2 ring-purple-200 dark:ring-purple-800'
  }
}

export const StatusColors: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <IndicatorLight color="#22c55e" />
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <IndicatorLight color="#ef4444" />
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <IndicatorLight color="#eab308" />
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <IndicatorLight color="#3b82f6" />
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <IndicatorLight color="#6b7280" />
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <IndicatorLight color="#a855f7" />
          <span></span>
        </div>
      </div>
    </div>
  )
}

export const SizeComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={6} />
          <p className="text-xs mt-2"> (6px)</p>
        </div>
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={8} />
          <p className="text-xs mt-2"> (8px)</p>
        </div>
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={12} />
          <p className="text-xs mt-2"> (12px)</p>
        </div>
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={16} />
          <p className="text-xs mt-2"> (16px)</p>
        </div>
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={24} />
          <p className="text-xs mt-2"> (24px)</p>
        </div>
      </div>
    </div>
  )
}

export const UserStatusList: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium"></h3>
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <IndicatorLight color="#22c55e" size={10} />
          <div className="flex-1">
            <p className="font-medium"></p>
            <p className="text-sm text-gray-500"> - 5</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <IndicatorLight color="#eab308" size={10} />
          <div className="flex-1">
            <p className="font-medium"></p>
            <p className="text-sm text-gray-500"> - 30</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <IndicatorLight color="#ef4444" size={10} />
          <div className="flex-1">
            <p className="font-medium"></p>
            <p className="text-sm text-gray-500"> - 2</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded">
          <IndicatorLight color="#3b82f6" size={10} />
          <div className="flex-1">
            <p className="font-medium"></p>
            <p className="text-sm text-gray-500"> - </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ServiceStatus: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium"></h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Web </h4>
            <IndicatorLight color="#22c55e" size={12} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            : 120ms
            <br />
            : 99.9%
          </p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium"></h4>
            <IndicatorLight color="#eab308" size={12} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            : 250ms
            <br />
            : 98.5%
          </p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">API </h4>
            <IndicatorLight color="#22c55e" size={12} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            : 89ms
            <br />
            : 99.8%
          </p>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium"></h4>
            <IndicatorLight color="#ef4444" size={12} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            : 
            <br />
            : 85.2%
          </p>
        </div>
      </div>
    </div>
  )
}

export const AnimationComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="flex items-center gap-8">
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={16} animation={true} />
          <p className="text-xs mt-2"></p>
        </div>
        <div className="text-center">
          <IndicatorLight color="#22c55e" size={16} animation={false} />
          <p className="text-xs mt-2"></p>
        </div>
      </div>
    </div>
  )
}

export const NotificationDot: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="flex gap-6">
        <div className="relative">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">📧</div>
          <div className="absolute -top-1 -right-1">
            <IndicatorLight color="#ef4444" size={8} />
          </div>
        </div>
        <div className="relative">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">🔔</div>
          <div className="absolute -top-1 -right-1">
            <IndicatorLight color="#ef4444" size={10} />
          </div>
        </div>
        <div className="relative">
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">💬</div>
          <div className="absolute -top-1 -right-1">
            <IndicatorLight color="#22c55e" size={8} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const CustomColors: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="grid grid-cols-4 gap-4">
        {[
          '#ff6b6b',
          '#4ecdc4',
          '#45b7d1',
          '#f9ca24',
          '#6c5ce7',
          '#fd79a8',
          '#00b894',
          '#e17055',
          '#74b9ff',
          '#fd79a8',
          '#00cec9',
          '#fdcb6e'
        ].map((color, index) => (
          <div key={index} className="text-center">
            <IndicatorLight color={color} size={14} />
            <p className="text-xs mt-2 font-mono">{color}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
