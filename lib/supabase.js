import { createClient } from "@supabase/supabase-js";

// Browser client (uses anon key — RLS enforced)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server client (uses service role — bypasses RLS, API routes only)
export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ============ REALTIME SUBSCRIPTIONS ============

/**
 * Subscribe to new comments on a specific file in realtime.
 * Returns an unsubscribe function.
 */
export function subscribeToComments(fileId, onNewComment) {
  const channel = supabase
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
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to file changes in a project (new uploads, status changes).
 */
export function subscribeToFiles(projectId, onFileChange) {
  const channel = supabase
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
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to project status changes.
 */
export function subscribeToProject(projectId, onProjectChange) {
  const channel = supabase
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
    supabase.removeChannel(channel);
  };
}
