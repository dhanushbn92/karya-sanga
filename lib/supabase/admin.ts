import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client.
 *
 * Uses the secret/service-role key — never expose this to the browser.
 * Use for: signed URL minting, bucket management, privileged jobs.
 *
 * Sessions are not persisted (server context). RLS bypass is intentional;
 * never accept user-controlled paths without validating ownership first.
 */
const SUPABASE_SECRET =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in env",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET, {
    auth: { persistSession: false },
  });
}

/**
 * Mint a short-lived signed URL for a storage object.
 * Returns null if the path is invalid or the file doesn't exist.
 */
export async function signedWallImageUrl(
  imagePath: string,
  expiresIn = 60 * 10,
): Promise<string | null> {
  if (!imagePath || imagePath.includes("..")) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("wall-images")
    .createSignedUrl(imagePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Best-effort: batch-sign a list of paths.
 */
export async function signedWallImageUrls(
  imagePaths: string[],
  expiresIn = 60 * 10,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (imagePaths.length === 0) return result;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("wall-images")
    .createSignedUrls(imagePaths, expiresIn);
  if (error || !data) return result;
  for (const row of data) {
    if (row.path && row.signedUrl) {
      result.set(row.path, row.signedUrl);
    }
  }
  return result;
}

/**
 * Delete an object from the wall-images bucket. Used by the post-delete flow.
 */
export async function deleteWallImage(imagePath: string): Promise<void> {
  if (!imagePath) return;
  const admin = createAdminClient();
  await admin.storage.from("wall-images").remove([imagePath]);
}

/**
 * Sign a path in the `lesson-slides` bucket for inline embed.
 *
 * Used by the deck viewer to render PDFs in an iframe and to feed PPT
 * files into Microsoft's Office Online viewer. The TTL is longer than
 * for images because a kid may sit on a presenter view for an hour.
 */
export async function signedLessonSlideUrl(
  slidePath: string,
  expiresIn = 60 * 60 * 2, // 2 hours
): Promise<string | null> {
  if (!slidePath || slidePath.includes("..")) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("lesson-slides")
    .createSignedUrl(slidePath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function deleteLessonSlide(slidePath: string): Promise<void> {
  if (!slidePath) return;
  const admin = createAdminClient();
  await admin.storage.from("lesson-slides").remove([slidePath]);
}
