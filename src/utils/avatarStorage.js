import { supabase } from "../supabaseClient";

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || "avatars";

/**
 * Check if the avatars storage bucket exists.
 * Non-blocking; warnings logged but don't affect app functionality.
 * Bucket creation and RLS policies must be set up manually via Supabase console.
 */
export const initializeAvatarStorage = async () => {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.warn("[Avatar Storage] Could not verify bucket status:", listError.message);
      console.info("[Avatar Storage] Make sure the 'avatars' bucket exists in Supabase Storage.");
      return;
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      console.warn(
        `[Avatar Storage] Bucket "${BUCKET_NAME}" not found.`,
        "Create it manually: Supabase Dashboard → Storage → Create bucket → Name it 'avatars' → Make it Private",
        "Then add RLS policies for upload/read access."
      );
    } else {
      console.log(`[Avatar Storage] Bucket "${BUCKET_NAME}" verified.`);
    }
  } catch (err) {
    console.warn(`[Avatar Storage] Initialization check warning: ${err.message}`);
  }
};

/**
 * Get the public URL for an avatar image.
 * Includes cache-busting timestamp to force fresh loads.
 */
export const getAvatarUrl = (userId, timestamp = Date.now()) => {
  const filePath = `${userId}/profile.jpg`;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return `${data.publicUrl}?t=${timestamp}`;
};

/**
 * Delete a user's avatar from storage.
 * Requires authentication.
 */
export const deleteUserAvatar = async (userId) => {
  try {
    // Consistent with profile.jsx — always profile.jpg
    const filePath = `${userId}/profile.jpg`;
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error) {
      throw new Error(error.message);
    }

    console.log(`[Avatar Storage] Avatar deleted for user ${userId}`);
  } catch (err) {
    console.error(`[Avatar Storage] Delete failed: ${err.message}`);
    throw err;
  }
};

/**
 * Check if user has an avatar file uploaded.
 */
export const userHasAvatar = async (userId) => {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(userId);

    if (error) {
      console.warn(`[Avatar Storage] List check failed: ${error.message}`);
      return false;
    }

    return data?.some((file) => file.name === "profile.jpg") || false;
  } catch (err) {
    console.warn(`[Avatar Storage] Existence check failed: ${err.message}`);
    return false;
  }
};
