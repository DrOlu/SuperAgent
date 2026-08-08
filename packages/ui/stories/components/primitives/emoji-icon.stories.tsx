import type { Meta, StoryObj } from '@storybook/react'

import { EmojiIcon } from '../../../src/components'

const meta: Meta<typeof EmojiIcon> = {
  title: 'Components/Primitives/EmojiIcon',
  component: EmojiIcon,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    emoji: {
      control: 'text',
      description: ' emoji '
    },
    className: {
      control: 'text',
      description: ' CSS '
    },
    size: {
      control: { type: 'range', min: 16, max: 80, step: 2 },
      description: ''
    },
    fontSize: {
      control: { type: 'range', min: 8, max: 40, step: 1 },
      description: 'emoji '
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {}
}

export const Star: Story = {
  args: {
    emoji: '⭐️'
  }
}

export const Heart: Story = {
  args: {
    emoji: '❤️'
  }
}

export const Smile: Story = {
  args: {
    emoji: '😊'
  }
}

export const Fire: Story = {
  args: {
    emoji: '🔥'
  }
}

export const Rocket: Story = {
  args: {
    emoji: '🚀'
  }
}

export const SmallSize: Story = {
  args: {
    emoji: '🎯',
    size: 20,
    fontSize: 12
  }
}

export const LargeSize: Story = {
  args: {
    emoji: '🌟',
    size: 60,
    fontSize: 30
  }
}

export const CustomStyle: Story = {
  args: {
    emoji: '💎',
    size: 40,
    fontSize: 20,
    className: 'border-2 border-blue-300 dark:border-blue-600 shadow-lg'
  }
}

export const EmojiCollection: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4"></h3>
        <div className="grid grid-cols-6 gap-4">
          {[
            '😀',
            '😃',
            '😄',
            '😁',
            '😊',
            '😍',
            '🤔',
            '😎',
            '🤗',
            '😴',
            '🙄',
            '😇',
            '❤️',
            '💙',
            '💚',
            '💛',
            '🧡',
            '💜',
            '⭐',
            '🌟',
            '✨',
            '🔥',
            '💎',
            '🎯',
            '🚀',
            '⚡',
            '🌈',
            '🎉',
            '🎊',
            '🏆'
          ].map((emoji, index) => (
            <EmojiIcon key={index} emoji={emoji} size={32} fontSize={16} />
          ))}
        </div>
      </div>
    </div>
  )
}

export const SizeComparison: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-4"></h3>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <EmojiIcon emoji="🎨" size={20} fontSize={12} />
          <p className="text-xs mt-2"> (20px)</p>
        </div>
        <div className="text-center">
          <EmojiIcon emoji="🎨" size={30} fontSize={16} />
          <p className="text-xs mt-2"> (30px)</p>
        </div>
        <div className="text-center">
          <EmojiIcon emoji="🎨" size={40} fontSize={20} />
          <p className="text-xs mt-2"> (40px)</p>
        </div>
        <div className="text-center">
          <EmojiIcon emoji="🎨" size={60} fontSize={30} />
          <p className="text-xs mt-2"> (60px)</p>
        </div>
      </div>
    </div>
  )
}

export const InUserInterface: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-4"></h3>

      {/*  */}
      <div className="space-y-3">
        <h4 className="font-medium"></h4>
        <div className="flex items-center gap-3">
          <EmojiIcon emoji="👤" size={40} fontSize={20} />
          <div>
            <p className="font-medium"></p>
            <p className="text-sm text-gray-500">user@example.com</p>
          </div>
        </div>
      </div>

      {/*  */}
      <div className="space-y-3">
        <h4 className="font-medium"></h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <EmojiIcon emoji="✅" size={24} fontSize={14} />
            <span></span>
          </div>
          <div className="flex items-center gap-2">
            <EmojiIcon emoji="⏳" size={24} fontSize={14} />
            <span></span>
          </div>
          <div className="flex items-center gap-2">
            <EmojiIcon emoji="❌" size={24} fontSize={14} />
            <span></span>
          </div>
        </div>
      </div>

      {/*  */}
      <div className="space-y-3">
        <h4 className="font-medium"></h4>
        <div className="space-y-1">
          <div className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
            <EmojiIcon emoji="🏠" size={24} fontSize={14} />
            <span></span>
          </div>
          <div className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
            <EmojiIcon emoji="📊" size={24} fontSize={14} />
            <span></span>
          </div>
          <div className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
            <EmojiIcon emoji="⚙️" size={24} fontSize={14} />
            <span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const CategoryIcons: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-4"></h3>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3"></h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="💼" size={24} fontSize={14} />
              <span></span>
            </div>
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="📈" size={24} fontSize={14} />
              <span></span>
            </div>
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="💻" size={24} fontSize={14} />
              <span></span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3"></h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="🍕" size={24} fontSize={14} />
              <span></span>
            </div>
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="✈️" size={24} fontSize={14} />
              <span></span>
            </div>
            <div className="flex items-center gap-2">
              <EmojiIcon emoji="🎵" size={24} fontSize={14} />
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AnimatedExample: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-4"></h3>
      <div className="flex gap-4">
        {['🎉', '🎊', '✨', '🌟', '⭐'].map((emoji, index) => (
          <div
            key={index}
            className="cursor-pointer transition-transform duration-200 hover:scale-110"
            onClick={() => alert(` ${emoji}`)}>
            <EmojiIcon emoji={emoji} size={36} fontSize={18} />
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500"></p>
    </div>
  )
}

export const BlurEffect: Story = {
  render: () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium mb-4"></h3>
      <p className="text-sm text-gray-600 mb-4">EmojiIcon  emoji </p>
      <div className="flex gap-6">
        <div className="text-center">
          <EmojiIcon emoji="🌙" size={50} fontSize={25} />
          <p className="text-xs mt-2"></p>
        </div>
        <div className="text-center">
          <EmojiIcon emoji="☀️" size={50} fontSize={25} />
          <p className="text-xs mt-2"></p>
        </div>
        <div className="text-center">
          <EmojiIcon emoji="🌈" size={50} fontSize={25} />
          <p className="text-xs mt-2"></p>
        </div>
      </div>
    </div>
  )
}
