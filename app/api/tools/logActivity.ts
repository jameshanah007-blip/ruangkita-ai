import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export async function logActivity(data: {
  userRequest: string;
  intent?: string;
  tool?: string;
  resultPreview?: string;
}) {
  if (!supabaseUrl || !supabaseSecretKey) {
    console.warn("Supabase environment variables belum dikonfigurasi.");
    return;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey
  );

  const { error } = await supabase
    .from("ai_activity_logs")
    .insert({
      user_request: data.userRequest,
      intent: data.intent || null,
      tool: data.tool || null,
      result_preview: data.resultPreview
        ? data.resultPreview.slice(0, 1000)
        : null,
    });

  if (error) {
    console.error(
      "Gagal mencatat aktivitas AI:",
      error.message
    );
  }
}