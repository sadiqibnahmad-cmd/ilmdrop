import { useEffect, useState, useCallback } from "react";
import { supabase, subscribeToComments, subscribeToFiles } from "@/lib/supabase";

/**
 * Hook: Subscribe to real-time comments on a file.
 * Returns [comments, addComment, loading]
 */
export function useRealtimeComments(fileId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch existing comments
  useEffect(() => {
    if (!fileId) return;

    async function fetch() {
      setLoading(true);
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("file_id", fileId)
        .order("created_at", { ascending: true });

      if (!error && data) setComments(data);
      setLoading(false);
    }

    fetch();
  }, [fileId]);

  // Subscribe to new comments in realtime
  useEffect(() => {
    if (!fileId) return;

    const unsubscribe = subscribeToComments(fileId, (newComment) => {
      setComments((prev) => {
        // Avoid duplicates (in case we just inserted it ourselves)
        if (prev.some((c) => c.id === newComment.id)) return prev;
        return [...prev, newComment];
      });
    });

    return unsubscribe;
  }, [fileId]);

  // Add a new comment
  const addComment = useCallback(
    async ({ body, authorName, commentType, timestampSec }) => {
      const { data, error } = await supabase.from("comments").insert({
        file_id: fileId,
        author_name: authorName || "Anonymous",
        body,
        comment_type: commentType || "feedback",
        timestamp_sec: timestampSec,
      }).select().single();

      if (error) {
        console.error("Failed to add comment:", error);
        return null;
      }

      // Optimistically add to local state (realtime will deduplicate)
      setComments((prev) => {
        if (prev.some((c) => c.id === data.id)) return prev;
        return [...prev, data];
      });

      return data;
    },
    [fileId]
  );

  return { comments, addComment, loading };
}

/**
 * Hook: Subscribe to real-time file changes in a project.
 * Returns [files, loading]
 */
export function useRealtimeFiles(projectId) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    async function fetch() {
      setLoading(true);
      const { data, error } = await supabase
        .from("files")
        .select("*, comments(count)")
        .eq("project_id", projectId)
        .order("uploaded_at", { ascending: true });

      if (!error && data) setFiles(data);
      setLoading(false);
    }

    fetch();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = subscribeToFiles(projectId, (eventType, newFile, oldFile) => {
      if (eventType === "INSERT") {
        setFiles((prev) => [...prev, { ...newFile, comments: [{ count: 0 }] }]);
      } else if (eventType === "UPDATE") {
        setFiles((prev) => prev.map((f) => (f.id === newFile.id ? { ...f, ...newFile } : f)));
      } else if (eventType === "DELETE") {
        setFiles((prev) => prev.filter((f) => f.id !== oldFile.id));
      }
    });

    return unsubscribe;
  }, [projectId]);

  return { files, setFiles, loading };
}
