import util from 'node:util'
import zlib from 'node:zlib'

import { loggerService } from '@logger'

const logger = loggerService.withContext('Utils:Zip')

//  zlib  gzip  gunzip  Promise 
const gzipPromise = util.promisify(zlib.gzip)
const gunzipPromise = util.promisify(zlib.gunzip)

/**
 * 
 * @param {string} str  JSON 
 * @returns {Promise<Buffer>}  Buffer
 */
export async function compress(str: string): Promise<Buffer> {
  try {
    const buffer = Buffer.from(str, 'utf-8')
    return await gzipPromise(buffer)
  } catch (error) {
    logger.error('Compression failed:', error as Error)
    throw error
  }
}

/**
 *  Buffer  JSON 
 * @param {Buffer} compressedBuffer -  Buffer
 * @returns {Promise<string>}  JSON 
 */
export async function decompress(compressedBuffer: Buffer): Promise<string> {
  try {
    const buffer = await gunzipPromise(compressedBuffer)
    return buffer.toString('utf-8')
  } catch (error) {
    logger.error('Decompression failed:', error as Error)
    throw error
  }
}
