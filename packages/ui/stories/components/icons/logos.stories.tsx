import type { Meta, StoryObj } from '@storybook/react'

import * as Models from '../../../src/components/icons/models'
import * as Providers from '../../../src/components/icons/providers'
import type { CompoundIcon } from '../../../src/components/icons/types'

interface IconEntry {
  Component: CompoundIcon
  name: string
}

/**
 * Build IconEntry[] from a barrel module's exports.
 * Each export is a compound icon (React component with `variant` prop + .Avatar).
 */
function toIconEntries(mod: Record<string, unknown>): IconEntry[] {
  return Object.entries(mod)
    .filter(([, value]) => typeof value === 'function')
    .map(([name, value]) => ({ Component: value as CompoundIcon, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const providerIcons: IconEntry[] = toIconEntries(Providers)
const modelIcons: IconEntry[] = toIconEntries(Models)

interface ShowcaseProps {
  fontSize?: number
}

type LogoKind = 'model' | 'provider'
const MODEL_LOGO_SCALE = 2 / 3

interface LogoMarkProps {
  Component: CompoundIcon
  fontSize: number
  kind: LogoKind
  name: string
  variant?: 'dark' | 'light'
}

export const LogoMark = ({ Component, fontSize, kind, name, variant }: LogoMarkProps) => {
  const shouldInset = kind === 'model' && !name.startsWith('Gpt') && name !== 'Aionlabs'
  const iconSize = shouldInset ? fontSize * MODEL_LOGO_SCALE : fontSize

  return (
    <span
      className="flex items-center justify-center"
      data-logo-kind={kind}
      data-logo-name={name}
      style={{ height: fontSize, width: fontSize }}>
      <Component style={{ fontSize: iconSize }} variant={variant} />
    </span>
  )
}

const IconGrid = ({ icons, fontSize, kind }: { icons: IconEntry[]; fontSize: number; kind: LogoKind }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-8">
    {icons.map(({ Component, name }) => (
      <div key={name} className="flex min-w-0 flex-col items-center justify-center">
        <div className="w-min overflow-hidden rounded-md border border-gray-200">
          <LogoMark Component={Component} fontSize={fontSize} kind={kind} name={name} />
        </div>
        <p className="mt-2 w-full break-words text-center text-sm">{name}</p>
      </div>
    ))}
  </div>
)

const AllIconsShowcase = ({ fontSize = 32 }: ShowcaseProps) => {
  return (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Providers ({providerIcons.length})</h2>
        <IconGrid icons={providerIcons} fontSize={fontSize} kind="provider" />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Models ({modelIcons.length})</h2>
        <IconGrid icons={modelIcons} fontSize={fontSize} kind="model" />
      </div>
    </div>
  )
}

interface LightVsDarkGridProps {
  icons: IconEntry[]
  fontSize: number
  kind: LogoKind
}

const LightVsDarkGrid = ({ icons, fontSize, kind }: LightVsDarkGridProps) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-6">
    {icons.map(({ Component, name }) => (
      <div key={name} className="flex min-w-0 flex-col items-center gap-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-md bg-white ring-1 ring-inset ring-gray-200">
            <LogoMark Component={Component} fontSize={fontSize} kind={kind} name={name} variant="light" />
          </div>
          <div className="overflow-hidden rounded-md bg-neutral-900">
            <LogoMark Component={Component} fontSize={fontSize} kind={kind} name={name} variant="dark" />
          </div>
          <span className="text-center text-xs text-gray-400">Light</span>
          <span className="text-center text-xs text-gray-400">Dark</span>
        </div>
        <p className="w-full break-words text-center text-sm">{name}</p>
      </div>
    ))}
  </div>
)

const AvatarGrid = ({ icons, size }: { icons: IconEntry[]; size: number }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-6">
    {icons.map(({ Component, name }) => {
      const AvatarComponent = Component.Avatar
      return (
        <div key={name} className="flex min-w-0 flex-col items-center gap-1">
          <div className="grid grid-cols-2 gap-2">
            <AvatarComponent className="overflow-hidden border border-gray-200" size={size} shape="circle" />
            <AvatarComponent className="overflow-hidden border border-gray-200" size={size} shape="rounded" />
            <span className="text-center text-xs text-gray-400">Circle</span>
            <span className="text-center text-xs text-gray-400">Rounded</span>
          </div>
          <p className="w-full break-words text-center text-sm">{name}</p>
        </div>
      )
    })}
  </div>
)

const AvatarShowcase = ({ fontSize = 32 }: ShowcaseProps) => {
  return (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Providers ({providerIcons.length})</h2>
        <AvatarGrid icons={providerIcons} size={fontSize} />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Models ({modelIcons.length})</h2>
        <AvatarGrid icons={modelIcons} size={fontSize} />
      </div>
    </div>
  )
}

const LightVsDarkShowcase = ({ fontSize = 32 }: ShowcaseProps) => {
  return (
    <div className="flex flex-col gap-8 p-4">
      <div>
        <h2 className="text-lg font-semibold mb-4">Providers</h2>
        <LightVsDarkGrid icons={providerIcons} fontSize={fontSize} kind="provider" />
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Models</h2>
        <LightVsDarkGrid icons={modelIcons} fontSize={fontSize} kind="model" />
      </div>
    </div>
  )
}

const meta: Meta<typeof AllIconsShowcase> = {
  title: 'Components/Icons/Logos',
  component: AllIconsShowcase,
  excludeStories: ['LogoMark'],
  parameters: {
    layout: 'fullscreen'
  },
  tags: ['autodocs'],
  argTypes: {
    fontSize: {
      control: { type: 'number', min: 16, max: 64, step: 4 },
      description: 'Logo  fontSize  1em ',
      defaultValue: 32
    }
  }
}

export default meta
type Story = StoryObj<typeof AllIconsShowcase>

/**
 *  Provider  Model 
 *
 *  SVGR  `icon: true` 
 * -  `width="1em"`  `height="1em"` `fontSize`
 * -  SVG clipPath 
 * -  SVG propsclassName, style, onClick 
 *
 * ## 
 *
 * ```tsx
 * import { Anthropic } from '@cherrystudio/ui/icons'
 *
 * //  fontSize 
 * <div style={{ fontSize: 24 }}>
 *   <Anthropic />
 * </div>
 *
 * //  className Tailwind
 * <Anthropic className="text-2xl" />
 *
 * //  SVG props
 * <Anthropic className="hover:opacity-80" onClick={handleClick} />
 * ```
 */
export const AllLogos: Story = {
  args: {
    fontSize: 48
  }
}

/**
 * Light  Dark 
 *
 *  Logo  Light Dark
 *  `<Anthropic />`  Tailwind  `dark:` 
 *
 * ```tsx
 * import { Anthropic } from '@cherrystudio/ui/icons'
 *
 * <Anthropic />                    // :dark mode  Dark, Light
 * <Anthropic variant="light" />    //  Light
 * <Anthropic variant="dark" />     //  Dark
 * ```
 */
export const LightVsDark: StoryObj<typeof LightVsDarkShowcase> = {
  render: (args) => <LightVsDarkShowcase {...args} />,
  args: {
    fontSize: 48
  }
}

/**
 * Avatar 
 *
 *  Logo  Avatar 
 *  `size`  Avatar 
 *
 * ```tsx
 * import { Anthropic } from '@cherrystudio/ui/icons'
 *
 * <Anthropic.Avatar size={32} />
 * <Anthropic.Avatar size={48} shape="rounded" />
 * ```
 */
export const Avatars: StoryObj<typeof AvatarShowcase> = {
  render: (args) => <AvatarShowcase {...args} />,
  args: {
    fontSize: 48
  }
}
