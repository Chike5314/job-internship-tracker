const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

/**
 * file.type is empty for some files chosen on some platforms. Whatever this
 * returns must be sent as BOTH the contentType in the upload-url request
 * and the Content-Type header on the PUT: storage.py signs ContentType
 * into the URL when present, and a mismatch makes S3 return 403, which
 * reads like a permissions problem rather than what it actually is.
 */
export function resolveContentType(file: File): string {
  if (file.type) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_CONTENT_TYPE[extension] ?? 'application/octet-stream'
}

/**
 * XMLHttpRequest, not fetch, and only here: fetch cannot report upload
 * progress, and a 10 MB transcript on a slow connection with no
 * indication reads as a hung interface.
 */
export function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with status ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(file)
  })
}
