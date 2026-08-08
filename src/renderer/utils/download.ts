import { loggerService } from '@logger'

const logger = loggerService.withContext('Utils:download')

export const download = (url: string, filename?: string) => {
  //  <a>  URL:
  // -  ( file:// )
  // -  URL ( blob: )
  // -  ( data:image/png, data:image/jpeg, data:image/svg+xml )
  //   (: data:text/html 
  //    data:image/svg+xml  CSP connect-src  data:  fetch )
  const SUPPORTED_PREFIXES = ['file://', 'blob:', 'data:image/png', 'data:image/jpeg', 'data:image/svg+xml']
  if (SUPPORTED_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    const link = document.createElement('a')
    link.href = url

    let resolvedFilename = filename
    if (!resolvedFilename) {
      if (url.startsWith('file://')) {
        const pathname = new URL(url).pathname
        resolvedFilename = decodeURIComponent(pathname.substring(pathname.lastIndexOf('/') + 1))
      } else if (url.startsWith('blob:')) {
        resolvedFilename = `${Date.now()}_diagram.svg`
      } else if (url.startsWith('data:')) {
        const mimeMatch = url.match(/^data:([^;,]+)[;,]/)
        const mimeType = mimeMatch && mimeMatch[1]
        const extension = getExtensionFromMimeType(mimeType)
        resolvedFilename = `${Date.now()}_download${extension}`
      } else resolvedFilename = 'download'
    }
    link.download = resolvedFilename

    document.body.appendChild(link)
    link.click()
    link.remove()
    return
  }

  //  URL
  return fetch(url)
    .then((response) => {
      let finalFilename = filename || 'download'

      if (!filename) {
        // Content-Disposition
        const contentDisposition = response.headers.get('Content-Disposition')
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
          if (filenameMatch) {
            finalFilename = filenameMatch[1]
          }
        }

        // URLURL
        const urlFilename = url.split('/').pop()
        if (urlFilename && urlFilename.includes('.')) {
          finalFilename = urlFilename
        }

        // Content-Type
        if (!finalFilename.includes('.')) {
          const contentType = response.headers.get('Content-Type')
          const extension = getExtensionFromMimeType(contentType)
          finalFilename += extension
        }

        // 
        finalFilename = `${Date.now()}_${finalFilename}`
      }

      return response.blob().then((blob) => ({ blob, finalFilename }))
    })
    .then(({ blob, finalFilename }) => {
      const blobUrl = URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = finalFilename
      document.body.appendChild(link)
      link.click()
      URL.revokeObjectURL(blobUrl)
      link.remove()
    })
    .catch((error) => {
      logger.error('Download failed:', error)
      // Re-throw so the caller can surface the failure (utils must not toast — it
      // would import the renderer services layer). useImageTools awaits this and
      // toasts from the component side.
      throw error
    })
}

// MIME
function getExtensionFromMimeType(mimeType: string | null): string {
  if (!mimeType) return '.bin' // 

  const mimeToExtension: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  }

  return mimeToExtension[mimeType] || '.bin'
}
