import { Kbd, KbdGroup } from '@cherrystudio/ui'
import type { Meta, StoryObj } from '@storybook/react'
import { Command, Copy, Save, Search } from 'lucide-react'
// import { Tooltip, TooltipContent, TooltipTrigger } from '@cherrystudio/ui/components/primitives/tooltip'

const meta: Meta<typeof Kbd> = {
  title: 'Components/Primitives/Kbd',
  component: Kbd,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: ','
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: { type: 'text' },
      description: ' CSS '
    },
    children: {
      control: { type: 'text' },
      description: ''
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// 
export const Default: Story = {
  args: {
    children: 'Ctrl'
  }
}

// 
export const SingleKeys: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Kbd>Ctrl</Kbd>
      <Kbd>Shift</Kbd>
      <Kbd>Alt</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>Space</Kbd>
      <Kbd>Delete</Kbd>
    </div>
  )
}

// 
export const AlphanumericKeys: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Kbd>A</Kbd>
      <Kbd>B</Kbd>
      <Kbd>C</Kbd>
      <Kbd>1</Kbd>
      <Kbd>2</Kbd>
      <Kbd>3</Kbd>
      <Kbd>F1</Kbd>
      <Kbd>F2</Kbd>
      <Kbd>F12</Kbd>
    </div>
  )
}

// 
export const ArrowKeys: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Kbd>↑</Kbd>
      <Kbd>↓</Kbd>
      <Kbd>←</Kbd>
      <Kbd>→</Kbd>
    </div>
  )
}

// 
export const KeyCombinations: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>C</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>V</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>F</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>A</Kbd>
        </KbdGroup>
      </div>
    </div>
  )
}

// Mac 
export const MacKeys: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>S</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>C</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>V</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-24 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>4</Kbd>
        </KbdGroup>
      </div>
    </div>
  )
}

// 
export const ThreeKeyCombinations: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-32 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-32 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>Alt</Kbd>
          <Kbd>Z</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-32 text-sm text-muted-foreground">:</span>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>F</Kbd>
        </KbdGroup>
      </div>
    </div>
  )
}

// 
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Kbd>
        <Command />
      </Kbd>
      <Kbd>
        <Copy />
      </Kbd>
      <Kbd>
        <Save />
      </Kbd>
      <Kbd>
        <Search />
      </Kbd>
    </div>
  )
}

//  Tooltip 
// export const InTooltip: Story = {
//   render: () => (
//     <div className="flex flex-wrap gap-4">
//       <Tooltip>
//         <TooltipTrigger asChild>
//           <button
//             type="button"
//             className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
//             
//           </button>
//         </TooltipTrigger>
//         <TooltipContent>
//           <Kbd>Ctrl+S</Kbd>
//         </TooltipContent>
//       </Tooltip>
//       <Tooltip>
//         <TooltipTrigger asChild>
//           <button
//             type="button"
//             className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
//             
//           </button>
//         </TooltipTrigger>
//         <TooltipContent>
//           <KbdGroup>
//             <Kbd>Ctrl</Kbd>
//             <Kbd>C</Kbd>
//           </KbdGroup>
//         </TooltipContent>
//       </Tooltip>
//       <Tooltip>
//         <TooltipTrigger asChild>
//           <button
//             type="button"
//             className="rounded bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80">
//             
//           </button>
//         </TooltipTrigger>
//         <TooltipContent>
//           <KbdGroup>
//             <Kbd>Ctrl</Kbd>
//             <Kbd>V</Kbd>
//           </KbdGroup>
//         </TooltipContent>
//       </Tooltip>
//     </div>
//   )
// }

// 
export const ShortcutList: Story = {
  render: () => (
    <div className="w-96 space-y-2 rounded-lg border p-4">
      <h3 className="mb-3 text-base font-semibold"></h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>S</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>O</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>F</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>H</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Z</Kbd>
          </KbdGroup>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm"></span>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Y</Kbd>
          </KbdGroup>
        </div>
      </div>
    </div>
  )
}

// 
export const EditorShortcuts: Story = {
  render: () => (
    <div className="w-[600px] space-y-4 rounded-lg border p-6">
      <h3 className="text-lg font-semibold"></h3>

      <div className="space-y-3">
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground"></h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>N</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>O</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>S</Kbd>
              </KbdGroup>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground"></h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>C</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>X</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>V</Kbd>
              </KbdGroup>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground"></h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>G</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>F</Kbd>
              </KbdGroup>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>Shift</Kbd>
                <Kbd>F</Kbd>
              </KbdGroup>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 
export const GameControls: Story = {
  render: () => (
    <div className="w-96 space-y-4 rounded-lg border p-6">
      <h3 className="text-lg font-semibold"></h3>

      <div className="space-y-3">
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground"></h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>W</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>S</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>A</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>D</Kbd>
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground"></h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>Space</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>Shift</Kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm"></span>
              <Kbd>E</Kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 
export const SpecialCharacters: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Kbd>⌘</Kbd>
      <Kbd>⌥</Kbd>
      <Kbd>⇧</Kbd>
      <Kbd>⌃</Kbd>
      <Kbd>⏎</Kbd>
      <Kbd>⌫</Kbd>
      <Kbd>⌦</Kbd>
      <Kbd>⇥</Kbd>
      <Kbd>⎋</Kbd>
      <Kbd>⇪</Kbd>
    </div>
  )
}

//  ()
export const CustomSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Kbd className="h-4 min-w-4 text-[10px]">S</Kbd>
      <Kbd>M</Kbd>
      <Kbd className="h-6 min-w-6 text-sm">L</Kbd>
      <Kbd className="h-8 min-w-8 text-base">XL</Kbd>
    </div>
  )
}

// 
export const RealWorldExample: Story = {
  render: () => (
    <div className="w-[700px] space-y-6">
      <div className="rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold"></h3>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
            <div className="flex items-center gap-3">
              <Save className="h-4 w-4" />
              <span className="text-sm"></span>
            </div>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>S</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
            <div className="flex items-center gap-3">
              <Copy className="h-4 w-4" />
              <span className="text-sm"></span>
            </div>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>C</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4" />
              <span className="text-sm"></span>
            </div>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>F</Kbd>
            </KbdGroup>
          </div>
          <div className="flex items-center justify-between rounded-md p-2 hover:bg-muted">
            <div className="flex items-center gap-3">
              <Command className="h-4 w-4" />
              <span className="text-sm"></span>
            </div>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>Shift</Kbd>
              <Kbd>P</Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-lg font-semibold"></h3>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
             <Kbd>Ctrl</Kbd> 
          </p>
          <p className="text-sm text-muted-foreground">
            {' '}
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>↑</Kbd>
            </KbdGroup>{' '}
            {' '}
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>↓</Kbd>
            </KbdGroup>{' '}
            
          </p>
          <p className="text-sm text-muted-foreground">
             <Kbd>Enter</Kbd> ,<Kbd>Esc</Kbd> 
          </p>
        </div>
      </div>
    </div>
  )
}
