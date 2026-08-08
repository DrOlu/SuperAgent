/**
 *  json 
 * @param {any} str 
 * @returns {boolean}  json 
 */
export function isJSON(str: any): boolean {
  if (typeof str !== 'string') {
    return false
  }

  try {
    return typeof JSON.parse(str) === 'object'
  } catch (e) {
    return false
  }
}

// TODO: unknown  any
/**
 *  JSON  null
 * @param {string} str 
 * @returns {any | null}  null
 */
export function parseJSON(str: string): any | null {
  try {
    return JSON.parse(str)
  } catch (e) {
    return null
  }
}
