import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { CustomFallbackProps } from '../../../src/components'
import { Button } from '../../../src/components'
import { ErrorBoundary } from '../../../src/components'

//  - 
const ThrowErrorComponent = ({ shouldThrow = false, errorMessage = '' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage)
  }
  return <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded"></div>
}

// 
const AsyncErrorComponent = () => {
  const [error, setError] = useState(false)

  const handleAsyncError = () => {
    setTimeout(() => {
      setError(true)
    }, 1000)
  }

  if (error) {
    throw new Error('')
  }

  return (
    <div className="p-4 space-y-2">
      <p></p>
      <Button onClick={handleAsyncError}>1</Button>
    </div>
  )
}

const meta: Meta<typeof ErrorBoundary> = {
  title: 'Components/Primitives/error-boundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: false,
      description: ''
    },
    fallbackComponent: {
      control: false,
      description: ''
    },
    onDebugClick: {
      control: false,
      description: ''
    },
    onReloadClick: {
      control: false,
      description: ''
    },
    debugButtonText: {
      control: 'text',
      description: ''
    },
    reloadButtonText: {
      control: 'text',
      description: ''
    },
    errorMessage: {
      control: 'text',
      description: ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ErrorBoundary>
      <ThrowErrorComponent shouldThrow={true} />
    </ErrorBoundary>
  )
}

export const CustomErrorMessage: Story = {
  render: () => (
    <ErrorBoundary errorMessage="">
      <ThrowErrorComponent shouldThrow={true} errorMessage="" />
    </ErrorBoundary>
  )
}

export const WithDebugButton: Story = {
  render: () => (
    <ErrorBoundary onDebugClick={() => alert('')} debugButtonText="">
      <ThrowErrorComponent shouldThrow={true} />
    </ErrorBoundary>
  )
}

export const WithReloadButton: Story = {
  render: () => (
    <ErrorBoundary onReloadClick={() => window.location.reload()} reloadButtonText="">
      <ThrowErrorComponent shouldThrow={true} />
    </ErrorBoundary>
  )
}

export const WithBothButtons: Story = {
  render: () => (
    <ErrorBoundary
      onDebugClick={() => alert('')}
      onReloadClick={() => alert('')}
      debugButtonText=""
      reloadButtonText=""
      errorMessage="">
      <ThrowErrorComponent shouldThrow={true} errorMessage="" />
    </ErrorBoundary>
  )
}

export const NoError: Story = {
  render: () => (
    <ErrorBoundary>
      <ThrowErrorComponent shouldThrow={false} />
    </ErrorBoundary>
  )
}

export const InteractiveDemo: Story = {
  render: function InteractiveDemo() {
    const [shouldThrow, setShouldThrow] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant={shouldThrow ? 'destructive' : 'default'} onClick={() => setShouldThrow(!shouldThrow)}>
            {shouldThrow ? '' : ''}
          </Button>
          <input
            type="text"
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            placeholder=""
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          />
        </div>

        <ErrorBoundary
          key={shouldThrow ? 'error' : 'normal'} // 
          onDebugClick={() => console.log('Debug clicked')}
          onReloadClick={() => setShouldThrow(false)}
          debugButtonText=""
          reloadButtonText=""
          errorMessage="">
          <ThrowErrorComponent shouldThrow={shouldThrow} errorMessage={errorMessage} />
        </ErrorBoundary>
      </div>
    )
  }
}

export const CustomFallback: Story = {
  render: () => {
    const CustomFallbackComponent = ({ error, onDebugClick, onReloadClick }: CustomFallbackProps) => (
      <div className="flex justify-center items-center w-full p-8">
        <div className="bg-gradient-to-r from-purple-400 to-pink-400 text-white rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold mb-2">😵 </h2>
          <p className="mb-4">...</p>
          <p className="text-sm opacity-90 mb-4">{error?.message}</p>
          <div className="flex gap-2 justify-center">
            {onDebugClick && (
              <Button size="sm" variant="outline" onClick={onDebugClick}>
                
              </Button>
            )}
            {onReloadClick && (
              <Button size="sm" variant="outline" onClick={onReloadClick}>
                
              </Button>
            )}
          </div>
        </div>
      </div>
    )

    return (
      <ErrorBoundary
        fallbackComponent={CustomFallbackComponent}
        onDebugClick={() => alert('')}
        onReloadClick={() => alert('')}>
        <ThrowErrorComponent shouldThrow={true} errorMessage="" />
      </ErrorBoundary>
    )
  }
}

export const NestedErrorBoundaries: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium"></h3>

      <ErrorBoundary errorMessage="">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded">
          <h4 className="font-medium mb-2"></h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4"></p>

          <ErrorBoundary errorMessage="">
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <h5 className="font-medium mb-2"></h5>
              <ThrowErrorComponent shouldThrow={true} errorMessage="" />
            </div>
          </ErrorBoundary>
        </div>
      </ErrorBoundary>
    </div>
  )
}

export const MultipleComponents: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium"></h3>

      <ErrorBoundary onReloadClick={() => window.location.reload()} reloadButtonText="">
        <div className="grid grid-cols-2 gap-4">
          <ThrowErrorComponent shouldThrow={false} />
          <ThrowErrorComponent shouldThrow={false} />
          <ThrowErrorComponent shouldThrow={true} errorMessage="" />
          <ThrowErrorComponent shouldThrow={false} />
        </div>
      </ErrorBoundary>
    </div>
  )
}

export const AsyncError: Story = {
  render: () => (
    <ErrorBoundary
      onReloadClick={() => window.location.reload()}
      reloadButtonText=""
      errorMessage="">
      <AsyncErrorComponent />
    </ErrorBoundary>
  )
}
