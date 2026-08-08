import { type HexColor, isHexColor } from '@renderer/utils/color'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type ClassValue = string | number | boolean | undefined | null | ClassDictionary | ClassArray

interface ClassDictionary {
  [id: string]: any
}

interface ClassArray extends Array<ClassValue> {}

/**
 *  class 
 *
 * Examples:
 * classNames('foo', 'bar'); // => 'foo bar'
 * classNames('foo', { bar: true }); // => 'foo bar'
 * classNames({ foo: true, bar: false }); // => 'foo'
 * classNames(['foo', 'bar']); // => 'foo bar'
 * classNames('foo', null, 'bar'); // => 'foo bar'
 * classNames({ message: true, 'message-assistant': true }); // => 'message message-assistant'
 * @param {ClassValue[]} args
 * @returns {string}
 */
export function classNames(...args: ClassValue[]): string {
  const classes: string[] = []

  args.forEach((arg) => {
    if (!arg) return

    if (typeof arg === 'string' || typeof arg === 'number') {
      classes.push(arg.toString())
    } else if (Array.isArray(arg)) {
      const inner = classNames(...arg)
      if (inner) {
        classes.push(inner)
      }
    } else if (typeof arg === 'object') {
      Object.entries(arg).forEach(([key, value]) => {
        if (value) {
          classes.push(key)
        }
      })
    }
  })

  return classes.filter(Boolean).join(' ')
}

function checkHexColor(value: string) {
  if (!isHexColor(value)) {
    throw new Error(`Invalid hex color string: ${value}`)
  }
}

function getRGB(hex: HexColor): [number, number, number] {
  checkHexColor(hex)
  // #
  const cleanHex = hex.charAt(0) === '#' ? hex.slice(1) : hex

  // hexRGB
  const r = parseInt(cleanHex.slice(0, 2), 16)
  const g = parseInt(cleanHex.slice(2, 4), 16)
  const b = parseInt(cleanHex.slice(4, 6), 16)

  return [r, g, b]
}

/**
 * 
 *
 * 0-1
 *  WCAG 2.0 
 *
 * :
 * 1. RGB0-1
 * 2. gamma
 * 3. 
 *
 * @param r -  (0-255)
 * @param g -  (0-255)
 * @param b -  (0-255)
 * @returns  (0-1)
 *
 * @see https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const rs = r / 255
  const gs = g / 255
  const bs = b / 255
  const normalize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * normalize(rs) + 0.7152 * normalize(gs) + 0.0722 * normalize(bs)
}

/**
 *  avatar
 * @param {string} char 
 * @returns {HexColor} 
 */
export function generateColorFromChar(char: string): HexColor {
  // Unicode
  const seed = char.charCodeAt(0)

  // 
  const a = 1664525
  const c = 1013904223
  const m = Math.pow(2, 32)

  // RGB
  let r = (a * seed + c) % m
  let g = (a * r + c) % m
  let b = (a * g + c) % m

  // 0-255
  r = Math.floor((r / m) * 256)
  g = Math.floor((g / m) * 256)
  b = Math.floor((b / m) * 256)

  // 
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * 
 *
 *  WCAG 2.0 
 * 
 * 
 *
 * @param {HexColor} backgroundColor - '#FFFFFF'
 * @returns {HexColor} ('#000000')('#FFFFFF')
 *
 * @see https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
 *
 * @throws {Error} 
 */
export function getForegroundColor(backgroundColor: HexColor): HexColor {
  checkHexColor(backgroundColor)

  const [r, g, b] = getRGB(backgroundColor)
  const luminance = getRelativeLuminance(r, g, b)

  return luminance > 0.179 ? '#000000' : '#FFFFFF'
}

// ts
// lg
//  file://./../assets/styles/responsive.css 
/**
 * 
 *
 * @property {number} xs -  0px
 * @property {number} sm -  576px
 * @property {number} md -  768px
 * @property {number} lg -  1080px
 * @property {number} xl -  1200px
 * @property {number} xxl -  1400px
 */
// export const breakpoints = {
//   xs: 0,
//   sm: 576,
//   md: 768,
//   lg: 1080,
//   xl: 1200,
//   xxl: 1400
// } as const

// type MediaQueryFunction = (styles: string) => string
// type MediaQueries = Record<keyof typeof breakpoints, MediaQueryFunction>

/**
 * 
 *
 * @example
 * // 
 * ```ts
 * const styles = {
 *   color: 'red',
 *   [media.md]: `
 *     color: blue;
 *   `,
 *   [media.lg]: `
 *     color: green;
 *   `
 * }
 * ```
 *
 * CSS
 * ```css
 *   color: red;
 *   @media (max-width: 768px) { color: blue; }
 *   @media (max-width: 992px) { color: green; }
 * ```
 */
// Not using for now
// export const media = objectKeys(breakpoints).reduce<MediaQueries>((acc, label) => {
//   const key = label
//   acc[key] = (styles: string): string => `
//     @media (max-width: ${breakpoints[key]}px) {
//       ${styles}
//     }
//   `
//   return acc
// }, {} as MediaQueries)

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
