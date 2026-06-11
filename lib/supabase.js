import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing Supabase env vars — check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

// Always create fresh — never cache across SSR/client boundary
export function getSupabase() {
  return createSupabaseClient();
}

// Server client — uses service role key, API routes only
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase server env vars");
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

// ── Realtime subscriptions ────────────────────────────────────────────────────

export function subscribeToComments(fileId, onNewComment) {
  const client = getSupabase();
  if (!client) return () => {};

  const channel = client
    .channel(`comments:${fileId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "comments",
      filter: `file_id=eq.${fileId}`,
    }, (payload) => onNewComment(payload.new))
    .subscribe();

  return () => client.removeChannel(channel);
}

export function subscribeToFiles(projectId, onFileChange) {
  const client = getSupabase();
  if (!client) return () => {};

  const channel = client
    .channel(`files:${projectId}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "files",
      filter: `project_id=eq.${projectId}`,
    }, (payload) => onFileChange(payload.eventType, payload.new, payload.old))
    .subscribe();

  return () => client.removeChannel(channel);
}

export function subscribeToProject(projectId, onProjectChange) {
  const client = getSupabase();
  if (!client) return () => {};

  const channel = client
    .channel(`project:${projectId}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "projects",
      filter: `id=eq.${projectId}`,
    }, (payload) => onProjectChange(payload.new))
    .subscribe();

  return () => client.removeChannel(channel);
}