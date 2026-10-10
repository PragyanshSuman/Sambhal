import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "./image";

/** Compresses and uploads a photo into the user's own folder; returns its public URL. */
export async function uploadPhoto(supabase: SupabaseClient, userId: string, file: File | Blob) {
  const blob = file instanceof File ? await compressImage(file) : file;
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, blob, {
    contentType: "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
}
