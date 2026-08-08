import type { Meta, StoryObj } from '@storybook/react'

import { DividerWithText } from '../../../src/components'

const meta: Meta<typeof DividerWithText> = {
  title: 'Components/Primitives/DividerWithText',
  component: DividerWithText,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    text: {
      control: 'text',
      description: ''
    },
    style: {
      control: false,
      description: ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    text: ''
  }
}

export const ShortText: Story = {
  args: {
    text: ''
  }
}

export const LongText: Story = {
  args: {
    text: ''
  }
}

export const EnglishText: Story = {
  args: {
    text: 'OR'
  }
}

export const WithNumbers: Story = {
  args: {
    text: ' 1'
  }
}

export const WithSymbols: Story = {
  args: {
    text: '• • •'
  }
}

export const CustomStyle: Story = {
  args: {
    text: '',
    style: {
      marginTop: '16px',
      marginBottom: '16px'
    }
  }
}

export const MultipleUsage: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4"></h3>
        <div className="max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1"></label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1"></label>
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder=""
            />
          </div>
          <button type="button" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
            
          </button>

          <DividerWithText text="" />

          <button type="button" className="w-full border border-gray-300 py-2 rounded-md hover:bg-gray-50">
             Google 
          </button>
          <button type="button" className="w-full border border-gray-300 py-2 rounded-md hover:bg-gray-50">
             GitHub 
          </button>
        </div>
      </div>
    </div>
  )
}

export const InSections: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4"></h2>
        <p className="text-gray-600 mb-4"></p>

        <DividerWithText text="" />

        <p className="text-gray-600 mb-4"></p>
        <p className="text-gray-600 mb-4"></p>

        <DividerWithText text="" />

        <p className="text-gray-600"></p>
      </div>
    </div>
  )
}

export const WithSteps: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>

      <div className="space-y-1">
        <p className="text-sm"></p>
      </div>

      <DividerWithText text=" 1 " />

      <div className="space-y-1">
        <p className="text-sm"></p>
      </div>

      <DividerWithText text=" 2 " />

      <div className="space-y-1">
        <p className="text-sm"></p>
      </div>

      <DividerWithText text=" 3 " />

      <div className="space-y-1">
        <p className="text-sm font-medium text-green-600"></p>
      </div>
    </div>
  )
}

export const DifferentSizes: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>

      <div className="space-y-4">
        <DividerWithText text="" />

        <DividerWithText text="" className="[&>span]:font-bold" />

        <DividerWithText text="" className="[&>span]:text-blue-600 [&>span]:dark:text-blue-400" />

        <DividerWithText text="" className="[&>span]:text-sm" />

        <DividerWithText
          text=""
          className="[&>span]:bg-gray-100 [&>span]:dark:bg-gray-800 [&>span]:px-2 [&>span]:py-1 [&>span]:rounded"
        />
      </div>
    </div>
  )
}

export const Timeline: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium"></h3>

      <div className="space-y-3">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
          <h4 className="font-medium"></h4>
          <p className="text-sm text-gray-600 dark:text-gray-400"></p>
        </div>

        <DividerWithText text="20241" />

        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded">
          <h4 className="font-medium"></h4>
          <p className="text-sm text-gray-600 dark:text-gray-400"></p>
        </div>

        <DividerWithText text="20243" />

        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
          <h4 className="font-medium"></h4>
          <p className="text-sm text-gray-600 dark:text-gray-400"></p>
        </div>

        <DividerWithText text="20245" />

        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
          <h4 className="font-medium"></h4>
          <p className="text-sm text-gray-600 dark:text-gray-400"></p>
        </div>
      </div>
    </div>
  )
}
