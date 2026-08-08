import { Button, Spinner } from '@cherrystudio/ui'
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

const meta: Meta<typeof Spinner> = {
  title: 'Components/Primitives/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    text: {
      control: false,
      description: 'React'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    text: '...'
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

export const WithReactNode: Story = {
  args: {
    text: (
      <span>
         <strong></strong> ...
      </span>
    )
  }
}

export const CustomStyle: Story = {
  args: {
    text: '',
    className: 'bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-700'
  }
}

export const LoadingStates: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2"></h4>
          <div className="space-y-2">
            <Spinner text="..." />
            <Spinner text="..." />
            <Spinner text="..." />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2"></h4>
          <div className="space-y-2">
            <Spinner text="..." />
            <Spinner text="..." />
            <Spinner text="..." />
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2"></h4>
          <div className="space-y-2">
            <Spinner text="..." />
            <Spinner text="..." />
            <Spinner text="..." />
          </div>
        </div>
      </div>
    </div>
  )
}

export const InteractiveDemo: Story = {
  render: function InteractiveDemo() {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingText, setLoadingText] = useState('...')

    const handleStartLoading = () => {
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
      }, 3000)
    }

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={handleStartLoading} disabled={isLoading}>
            {isLoading ? '...' : ''}
          </Button>
          <input
            type="text"
            value={loadingText}
            onChange={(e) => setLoadingText(e.target.value)}
            placeholder=""
            className="px-3 py-1 border border-gray-300 rounded text-sm"
            disabled={isLoading}
          />
        </div>

        {isLoading && (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
            <Spinner text={loadingText} />
          </div>
        )}
      </div>
    )
  }
}

export const InComponents: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>

      <div className="space-y-4">
        {/*  */}
        <div className="space-y-2">
          <h4 className="font-medium"></h4>
          <div className="relative">
            <input
              type="text"
              placeholder="..."
              className="w-full px-4 py-2 pr-32 border border-gray-300 rounded-lg"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Spinner text="" />
            </div>
          </div>
        </div>

        {/*  */}
        <div className="space-y-2">
          <h4 className="font-medium"></h4>
          <div className="flex gap-2">
            <Button disabled className="cursor-not-allowed opacity-70">
              <Spinner text="..." className="text-sm" />
            </Button>
            <Button disabled className="cursor-not-allowed opacity-70">
              <Spinner text="..." className="text-sm" />
            </Button>
          </div>
        </div>

        {/*  */}
        <div className="space-y-2">
          <h4 className="font-medium"></h4>
          <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
            <Spinner text="..." />
          </div>
        </div>

        {/*  */}
        <div className="space-y-2">
          <h4 className="font-medium"></h4>
          <div className="space-y-2">
            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
              <p> 1</p>
            </div>
            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded">
              <p> 2</p>
            </div>
            <div className="p-3 border border-gray-200 dark:border-gray-700 rounded text-center">
              <Spinner text="..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const DifferentSizes: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="w-20 text-sm">:</span>
          <Spinner text="" className="text-xs" />
        </div>
        <div className="flex items-center gap-4">
          <span className="w-20 text-sm">:</span>
          <Spinner text="..." />
        </div>
        <div className="flex items-center gap-4">
          <span className="w-20 text-sm">:</span>
          <Spinner text="..." className="text-lg" />
        </div>
      </div>
    </div>
  )
}

export const ColorVariations: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Spinner text="" />
          <Spinner text="" className="text-blue-600 dark:text-blue-400" />
          <Spinner text="" className="text-green-600 dark:text-green-400" />
          <Spinner text="" className="text-orange-600 dark:text-orange-400" />
          <Spinner text="" className="text-red-600 dark:text-red-400" />
          <Spinner text="" className="text-purple-600 dark:text-purple-400" />
        </div>
      </div>
    </div>
  )
}

export const BackgroundVariations: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>
      <div className="space-y-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded border">
          <Spinner text="" />
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded">
          <Spinner text="" />
        </div>
        <div className="p-4 bg-blue-500 text-white rounded">
          <Spinner text="" className="text-white" />
        </div>
        <div className="p-4 bg-green-500 text-white rounded">
          <Spinner text="" className="text-white" />
        </div>
      </div>
    </div>
  )
}

export const LoadingSequence: Story = {
  render: function LoadingSequence() {
    const [step, setStep] = useState(0)
    const steps = ['...', '...', '...', '...', '...', '!']

    const nextStep = () => {
      setStep((prev) => (prev + 1) % steps.length)
    }

    const currentStep = steps[step]
    const isComplete = step === steps.length - 1

    return (
      <div className="space-y-4">
        <Button onClick={nextStep}>{isComplete ? '' : ''}</Button>

        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
          {isComplete ? (
            <div className="text-center text-green-600 dark:text-green-400 font-medium">✅ {currentStep}</div>
          ) : (
            <Spinner text={currentStep} />
          )}
        </div>

        <div className="text-sm text-gray-500">
           {step + 1} / {steps.length}
        </div>
      </div>
    )
  }
}

export const RealWorldUsage: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium"></h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/*  */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h4 className="font-medium mb-3"></h4>
          <div className="space-y-3">
            <input type="email" placeholder="" className="w-full px-3 py-2 border border-gray-300 rounded" />
            <input type="password" placeholder="" className="w-full px-3 py-2 border border-gray-300 rounded" />
            <div className="text-center">
              <Spinner text="..." />
            </div>
          </div>
        </div>

        {/*  */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h4 className="font-medium mb-3"></h4>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Spinner text=" (75%)" />
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>
        </div>

        {/*  */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h4 className="font-medium mb-3"></h4>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
            <div className="text-center mt-4">
              <Spinner text="..." />
            </div>
          </div>
        </div>

        {/*  */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h4 className="font-medium mb-3"></h4>
          <div className="text-center">
            <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
              <Spinner text="..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
