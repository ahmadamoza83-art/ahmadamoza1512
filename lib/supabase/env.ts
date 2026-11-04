const supabaseUrlValue = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function supabaseUrl() {
  return supabaseUrlValue.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

function supabaseKey() {
  return supabasePublishableKey || supabaseAnonKey;
}

export function getSupabaseEnv() {
  const url = supabaseUrl();
  const key = supabaseKey();

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. These must be available when next build runs.",
    );
  }

  return { url, key };
}

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl() && supabaseKey());
}
