import { createClient } from "@supabase/supabase-js";

// Browser client (lazy — only created when actually called)
let _supabase = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }
  return _supabase;
}

// For backward compat — but prefer getSupabase()
export const supabase = typeof window !== "undefined"
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
  : null;

// Server client (uses service role — bypasses RLS, API routes only)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
}

// ============ REALTIME SUBSCRIPTIONS ============

export function subscribeToComments(fileId, onNewComment) {
  const client = getSupabase();
  const channel = client
    .channel(`comments:${fileId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "comments",
        filter: `file_id=eq.${fileId}`,
      },
      (payload) => {
        onNewComment(payload.new);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToFiles(projectId, onFileChange) {
  const client = getSupabase();
  const channel = client
    .channel(`files:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "files",
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        onFileChange(payload.eventType, payload.new, payload.old);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToProject(projectId, onProjectChange) {
  const client = getSupabase();
  const channel = client
    .channel(`project:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "projects",
        filter: `id=eq.${projectId}`,
      },
      (payload) => {
        onProjectChange(payload.new);
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}