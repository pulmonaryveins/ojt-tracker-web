import { supabase } from './supabase'

/**
 * Attempts to create a storage bucket as a best-effort.
 * All errors are silently swallowed — creation may be blocked by RLS
 * (anon key cannot create buckets), or the bucket may already exist.
 * The actual upload call that follows will surface a clear error if the
 * bucket truly doesn't exist.
 */
async function tryCreateBucket(name: string): Promise<void> {
  await supabase.storage.createBucket(name, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  })
  // Intentionally ignoring errors: RLS violation, "already exists", etc.
}

/**
 * Uploads a file to a Supabase Storage bucket, creating the bucket first
 * (best-effort). Throws a helpful error if the bucket doesn't exist.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File,
  options: { upsert?: boolean } = {}
): Promise<string> {
  await tryCreateBucket(bucket)

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: options.upsert ?? false })

  if (error) {
    if (
      error.message.toLowerCase().includes('bucket') ||
      error.message.toLowerCase().includes('not found')
    ) {
      throw new Error(
        `Storage bucket "${bucket}" does not exist. ` +
        `Please create it in your Supabase dashboard: ` +
        `Storage → New bucket → name: "${bucket}" → set to Public.`
      )
    }
    throw error
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}
