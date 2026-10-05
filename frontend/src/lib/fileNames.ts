/**
 * Every upload's key ends in "<32 hex>-<file name>" (build_key in
 * src/common/storage.py), which is how a screen can show the name a file was
 * chosen under without the API carrying it separately.
 */
export function nameFromKey(key: string): string | null {
  const last = key.split('/').pop() ?? ''
  return /^[0-9a-f]{32}-(.+)$/.exec(last)?.[1] ?? null
}

/** The same name, read off a presigned link, which carries the key as its path. */
export function nameFromUrl(url: string): string | null {
  try {
    return nameFromKey(decodeURIComponent(new URL(url).pathname))
  } catch {
    return null
  }
}
