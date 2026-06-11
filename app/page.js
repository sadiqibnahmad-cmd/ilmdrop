"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { getSupabase } from "../lib/supabase";
import { subscribeToComments, subscribeToProject } from "../lib/supabase";

// ── helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function fmtSize(b) {
  if (!b) return "–";
  if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
}
function fmtTime(s) {
  if (s == null) return "";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
function timeAgo(iso) {
  const d = (Date.now() - new Date(iso)) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + "m ago";
  if (d < 86400) return Math.floor(d / 3600) + "h ago";
  return Math.floor(d / 86400) + "d ago";
}
function fileCat(type = "") {
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("image/")) return "image";
  return "other";
}

// ── status config ─────────────────────────────────────────────────────────────
const STATUS = {
  reviewing: { label: "Reviewing",     bg: "#FFF3E0", color: "#B8730F", dot: "#E5A332" },
  approved:  { label: "Done",          bg: "#E8F5E9", color: "#2E7D32", dot: "#4CAF50" },
  revision:  { label: "Needs changes", bg: "#FFEBEE", color: "#C62828", dot: "#EF5350" },
};

// ── icon themes ───────────────────────────────────────────────────────────────
const ICON_THEME = {
  video: { bg: "#DBEAFE", color: "#3B82F6" },
  audio: { bg: "#FDE8E8", color: "#E05A5A" },
  image: { bg: "#E0F2F1", color: "#26A69A" },
  other: { bg: "#F3E8FF", color: "#8B5CF6" },
};

function MediaIcon({ category, size = 44 }) {
  const t = ICON_THEME[category] || ICON_THEME.other;
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.48} height={size * 0.48} viewBox="0 0 24 24" fill="none">
        {category === "video" && <><rect x="2" y="4" width="20" height="16" rx="2" stroke={t.color} strokeWidth="1.8" /><path d="M10 9l5 3-5 3z" fill={t.color} /></>}
        {category === "audio" && <><path d="M9 18V5l12-2v13" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke={t.color} strokeWidth="1.8" /><circle cx="18" cy="16" r="3" stroke={t.color} strokeWidth="1.8" /></>}
        {category === "image" && <><rect x="3" y="3" width="18" height="18" rx="2" stroke={t.color} strokeWidth="1.8" /><circle cx="8.5" cy="8.5" r="1.5" fill={t.color} /><path d="M21 15l-5-5L5 21" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>}
        {category === "other" && <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={t.color} strokeWidth="1.8" /><polyline points="14 2 14 8 20 8" stroke={t.color} strokeWidth="1.8" /></>}
      </svg>
    </div>
  );
}

// ── bottom nav ────────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab }) {
  const items = [
    { key: "projects", label: "Projects", d: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
    { key: "updates",  label: "Updates",  d: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></> },
    { key: "account",  label: "Account",  d: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
  ];
  return (
    <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FAFAF6", borderTop: "1px solid #E8E6DE", display: "flex", justifyContent: "space-around", padding: "8px 0 20px", zIndex: 50, maxWidth: 420, margin: "0 auto" }}>
      {items.map(it => (
        <button key={it.key} onClick={() => onTab(it.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 20px", color: tab === it.key ? "#3B82F6" : "#9E9E8F" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{it.d}</svg>
          <span style={{ fontSize: 11, fontWeight: tab === it.key ? 600 : 400 }}>{it.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── share modal ───────────────────────────────────────────────────────────────
function ShareModal({ project, onClose }) {
  const [pw, setPw] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, password: pw || undefined }),
      });
      const data = await res.json();
      if (data.url) setShareUrl(data.url);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const copy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#FAFAF6", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#D5D3CA", margin: "0 auto 20px" }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#2C2B26", marginBottom: 4 }}>Share project</h3>
        <p style={{ fontSize: 13, color: "#9E9E8F", marginBottom: 20 }}>Anyone with this link can view and comment.</p>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#7A796F", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" }}>Password (optional)</label>
        <input type="text" placeholder="Leave blank for open access" value={pw} onChange={e => setPw(e.target.value)} style={{ width: "100%", padding: "12px 14px", fontSize: 15, borderRadius: 10, border: "1px solid #E8E6DE", background: "#fff", color: "#2C2B26", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
        {!shareUrl ? (
          <button onClick={generate} disabled={loading} style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 600, borderRadius: 12, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer", marginBottom: 12 }}>
            {loading ? "Generating…" : "Generate link"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input type="text" readOnly value={shareUrl} style={{ flex: 1, padding: "12px 14px", fontSize: 12, borderRadius: 10, border: "1px solid #E8E6DE", background: "#fff", color: "#2C2B26", outline: "none", fontFamily: "monospace" }} />
            <button onClick={copy} style={{ padding: "12px 20px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", background: copied ? "#2E7D32" : "#3B82F6", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "Copied!" : "Copy"}</button>
          </div>
        )}
        <button onClick={onClose} style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 600, borderRadius: 12, border: "1px solid #E8E6DE", background: "#fff", color: "#7A796F", cursor: "pointer" }}>Done</button>
      </div>
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function IlmDrop() {
  const [screen, setScreen]               = useState("projects");
  const [tab, setTab]                     = useState("projects");
  const [projects, setProjects]           = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeFileId, setActiveFileId]   = useState(null);
  const [showShare, setShowShare]         = useState(false);
  const [creating, setCreating]           = useState(false);
  const [newName, setNewName]             = useState("");
  const [commentText, setCommentText]     = useState("");
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentType, setCommentType]     = useState("feedback");
  const [pinTime, setPinTime]             = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [comments, setComments]           = useState([]);
  const mediaRef = useRef(null);
  const fileInputRef = useRef(null);

  const db = getSupabase();
  const project = projects.find(p => p.id === activeProjectId);
  const file    = project?.files?.find(f => f.id === activeFileId);

  // ── load projects ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingProjects(true);
      const { data, error } = await db
        .from("projects")
        .select("*, files(*, comments(count))")
        .order("created_at", { ascending: false });
      if (!error && data) setProjects(data);
      setLoadingProjects(false);
    }
    load();
  }, []);

  // ── load comments for active file ─────────────────────────────────────────
  useEffect(() => {
    if (!activeFileId) return;
    async function load() {
      const { data } = await db.from("comments").select("*").eq("file_id", activeFileId).order("created_at", { ascending: true });
      if (data) setComments(data);
    }
    load();
    const unsub = subscribeToComments(activeFileId, (c) => {
      setComments(prev => prev.some(x => x.id === c.id) ? prev : [...prev, c]);
    });
    return unsub;
  }, [activeFileId]);

  // ── subscribe to project status changes ───────────────────────────────────
  useEffect(() => {
    if (!activeProjectId) return;
    const unsub = subscribeToProject(activeProjectId, (updated) => {
      setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
    });
    return unsub;
  }, [activeProjectId]);

  // ── navigation helpers ────────────────────────────────────────────────────
  const openProject = (id) => { setActiveProjectId(id); setActiveFileId(null); setComments([]); setScreen("project"); };
  const openFile    = (id) => { setActiveFileId(id); setComments([]); setScreen("file"); };
  const goBack      = () => {
    if (screen === "file")    { setActiveFileId(null); setScreen("project"); }
    else if (screen === "project") { setActiveProjectId(null); setScreen("projects"); }
  };

  // ── create project ─────────────────────────────────────────────────────────
  const createProject = async () => {
    if (!newName.trim()) return;
    const { data, error } = await db.from("projects").insert({ name: newName.trim(), status: "reviewing" }).select("*, files(*)").single();
    if (!error && data) {
      setProjects(prev => [{ ...data, files: [] }, ...prev]);
      setNewName(""); setCreating(false);
      openProject(data.id);
    }
  };

  // ── upload files ───────────────────────────────────────────────────────────
  const handleUpload = async (fileList) => {
    if (!activeProjectId || !fileList.length) return;
    setUploading(true);
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      try {
        // 1. Get presigned URL
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: activeProjectId, filename: f.name, fileType: f.type, fileSize: f.size }),
        });
        const { file: fileRecord, uploadUrl } = await res.json();
        // 2. Upload to S3
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", e => {
            if (e.lengthComputable) setUploadProgress(prev => ({ ...prev, [f.name]: Math.round(e.loaded / e.total * 100) }));
          });
          xhr.addEventListener("load", () => xhr.status < 300 ? resolve() : reject());
          xhr.addEventListener("error", reject);
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", f.type);
          xhr.send(f);
        });
        // 3. Add to local state
        setProjects(prev => prev.map(p => p.id === activeProjectId
          ? { ...p, files: [...(p.files || []), { ...fileRecord, comments: [{ count: 0 }] }] }
          : p
        ));
      } catch (e) { console.error("Upload failed", e); }
      setUploadProgress(prev => { const n = { ...prev }; delete n[f.name]; return n; });
    }
    setUploading(false);
  };

  // ── post comment ───────────────────────────────────────────────────────────
  const postComment = async () => {
    if (!commentText.trim() || !activeFileId) return;
    const { data, error } = await db.from("comments").insert({
      file_id: activeFileId,
      author_name: commentAuthor.trim() || "Anonymous",
      body: commentText.trim(),
      comment_type: commentType,
      timestamp_sec: pinTime,
    }).select().single();
    if (!error && data) {
      setComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data]);
      setCommentText(""); setPinTime(null);
    }
  };

  // ── update project status ─────────────────────────────────────────────────
  const setStatus = async (pid, status) => {
    await db.from("projects").update({ status }).eq("id", pid);
    setProjects(prev => prev.map(p => p.id === pid ? { ...p, status } : p));
  };

  // ── approve file ──────────────────────────────────────────────────────────
  const approveFile = async (fid) => {
    await db.from("files").update({ is_final: true }).eq("id", fid);
    setProjects(prev => prev.map(p => p.id === activeProjectId
      ? { ...p, files: p.files.map(f => f.id === fid ? { ...f, is_final: true } : f) }
      : p
    ));
  };

  // ── download file ─────────────────────────────────────────────────────────
  const downloadFile = async (f) => {
    const res = await fetch(`/api/download?key=${encodeURIComponent(f.s3_key)}&filename=${encodeURIComponent(f.filename)}`);
    const { url } = await res.json();
    const a = document.createElement("a"); a.href = url; a.download = f.filename; a.click();
  };

  const totalComments = (p) => (p.files || []).reduce((a, f) => a + (f.comments?.[0]?.count || 0), 0);
  const card = { background: "#fff", borderRadius: 16, border: "1px solid #EDEBE4", padding: "14px 16px", marginBottom: 10, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F4EF", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#2C2B26", paddingBottom: 80, maxWidth: 420, margin: "0 auto" }}>

      {/* ── PROJECTS LIST ── */}
      {screen === "projects" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>My Projects</h1>
            <button onClick={() => setCreating(true)} style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "#E8F0FE", color: "#3B82F6", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>

          {creating && (
            <div style={{ ...card, cursor: "default", display: "flex", gap: 8, padding: "12px 14px" }}>
              <input autoFocus type="text" placeholder="Project name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} style={{ flex: 1, padding: "10px 12px", fontSize: 15, borderRadius: 10, border: "1px solid #E8E6DE", background: "#FAFAF6", color: "#2C2B26", outline: "none" }} />
              <button onClick={createProject} disabled={!newName.trim()} style={{ padding: "10px 18px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", background: newName.trim() ? "#3B82F6" : "#E8E6DE", color: newName.trim() ? "#fff" : "#B5B3AA", cursor: newName.trim() ? "pointer" : "default" }}>Create</button>
            </div>
          )}

          <p style={{ fontSize: 12, fontWeight: 700, color: "#B5B3AA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Recent</p>

          {loadingProjects && <p style={{ color: "#B5B3AA", fontSize: 14, textAlign: "center", padding: 40 }}>Loading…</p>}

          {!loadingProjects && projects.length === 0 && !creating && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: 15, color: "#9E9E8F", marginBottom: 4 }}>No projects yet</p>
              <p style={{ fontSize: 13, color: "#B5B3AA" }}>Tap + to create your first project.</p>
            </div>
          )}

          {projects.map(p => {
            const s = STATUS[p.status] || STATUS.reviewing;
            const cc = totalComments(p);
            const cat = fileCat(p.files?.[0]?.file_type);
            return (
              <div key={p.id} onClick={() => openProject(p.id)} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <MediaIcon category={cat} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 2px", color: "#2C2B26" }}>{p.name}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#9E9E8F" }}>
                      <span>{(p.files || []).length} file{(p.files || []).length !== 1 ? "s" : ""}</span>
                      <span style={{ fontSize: 8, color: s.dot }}>●</span>
                      <span>{s.label}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6, background: s.bg, color: s.color }}>{s.label}</span>
                    {cc > 0 && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: "#FFF3E0", color: "#B8730F" }}>{cc} comment{cc !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PROJECT DETAIL ── */}
      {screen === "project" && project && (
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2C2B26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{project.name}</h2>
            </div>
            <button onClick={() => setShowShare(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "#7A796F" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            </button>
          </div>

          {/* upload zone */}
          <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed #D5D3CA", borderRadius: 14, padding: "28px 16px", textAlign: "center", cursor: "pointer", marginBottom: 20, background: "#FAFAF6" }}>
            <input ref={fileInputRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={e => handleUpload(Array.from(e.target.files))} style={{ display: "none" }} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#B5B3AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#7A796F", margin: 0 }}>{uploading ? "Uploading…" : "Upload files"}</p>
            <p style={{ fontSize: 12, color: "#B5B3AA", margin: "4px 0 0" }}>Video, audio, images · up to 2 GB</p>
          </div>

          {/* upload progress bars */}
          {Object.entries(uploadProgress).map(([name, pct]) => (
            <div key={name} style={{ marginBottom: 8, padding: "10px 14px", background: "#E8F0FE", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "#2C2B26", fontWeight: 500 }}>{name}</span>
                <span style={{ color: "#3B82F6" }}>{pct}%</span>
              </div>
              <div style={{ height: 4, background: "#BFDBFE", borderRadius: 2 }}>
                <div style={{ height: 4, background: "#3B82F6", borderRadius: 2, width: pct + "%" }} />
              </div>
            </div>
          ))}

          <p style={{ fontSize: 12, fontWeight: 700, color: "#B5B3AA", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Files</p>

          {(project.files || []).length === 0 && (
            <p style={{ fontSize: 13, color: "#B5B3AA", textAlign: "center", padding: "20px 0" }}>No files yet — upload something above.</p>
          )}

          {(project.files || []).map(f => (
            <div key={f.id} onClick={() => openFile(f.id)} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <MediaIcon category={fileCat(f.file_type)} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</p>
                  <p style={{ fontSize: 13, color: "#9E9E8F", margin: 0 }}>{fmtSize(f.file_size)}</p>
                </div>
                {f.version > 1 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, border: "1px solid #E8E6DE", color: "#7A796F" }}>v{f.version}</span>}
                {f.is_final && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={() => setStatus(project.id, "approved")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: 14, border: `2px solid ${project.status === "approved" ? "#A5D6A7" : "#C8E6C9"}`, background: project.status === "approved" ? "#C8E6C9" : "#E8F5E9", color: "#2E7D32", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Approve
            </button>
            <button onClick={() => setStatus(project.id, "revision")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: 14, border: `2px solid ${project.status === "revision" ? "#EF9A9A" : "#FFCDD2"}`, background: project.status === "revision" ? "#FFCDD2" : "#FFEBEE", color: "#C62828", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Revise
            </button>
          </div>
        </div>
      )}

      {/* ── FILE DETAIL ── */}
      {screen === "file" && file && (
        <div style={{ padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 0 16px" }}>
            <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2C2B26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.filename}</p>
              <p style={{ fontSize: 12, color: "#9E9E8F", margin: 0 }}>{fmtSize(file.file_size)}</p>
            </div>
          </div>

          {/* inline preview placeholder — real streaming via S3 presigned URL */}
          <div style={{ background: "#F0EEE8", borderRadius: 12, padding: "40px 16px", textAlign: "center", marginBottom: 16 }}>
            <MediaIcon category={fileCat(file.file_type)} size={60} />
            <p style={{ fontSize: 13, color: "#9E9E8F", marginTop: 12 }}>File stored in S3</p>
            <button onClick={() => downloadFile(file)} style={{ marginTop: 12, padding: "10px 24px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", cursor: "pointer" }}>
              Download / Preview
            </button>
          </div>

          {/* comments */}
          <p style={{ fontSize: 12, fontWeight: 700, color: "#B5B3AA", textTransform: "uppercase", letterSpacing: "0.08em", margin: "20px 0 12px" }}>Feedback ({comments.length})</p>

          {comments.length === 0 && <p style={{ fontSize: 13, color: "#B5B3AA", marginBottom: 16 }}>No feedback yet.</p>}

          {comments.map(c => (
            <div key={c.id} style={{ background: c.comment_type === "correction" ? "#FFF8E1" : c.comment_type === "error" ? "#FFEBEE" : "#FAFAF6", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid #EDEBE4" }}>
              {c.timestamp_sec != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B8730F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#B8730F" }}>{fmtTime(c.timestamp_sec)}</span>
                </div>
              )}
              <p style={{ fontSize: 15, fontWeight: 500, color: "#2C2B26", margin: "0 0 4px", lineHeight: 1.4 }}>{c.body}</p>
              <p style={{ fontSize: 12, color: "#9E9E8F", margin: 0 }}>{c.author_name} · {timeAgo(c.created_at)}</p>
            </div>
          ))}

          {/* comment form */}
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EDEBE4", padding: 14, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <input type="text" placeholder="Your name" value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} style={{ flex: "0 0 110px", padding: "8px 10px", fontSize: 13, borderRadius: 8, border: "1px solid #E8E6DE", background: "#FAFAF6", color: "#2C2B26", outline: "none" }} />
              {["feedback", "correction", "error"].map(t => (
                <button key={t} onClick={() => setCommentType(t)} style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, border: commentType === t ? "1.5px solid" : "1px solid #E8E6DE", borderColor: commentType === t ? (t === "feedback" ? "#3B82F6" : t === "correction" ? "#B8730F" : "#C62828") : "#E8E6DE", background: commentType === t ? (t === "feedback" ? "#E8F0FE" : t === "correction" ? "#FFF8E1" : "#FFEBEE") : "#fff", color: commentType === t ? (t === "feedback" ? "#3B82F6" : t === "correction" ? "#B8730F" : "#C62828") : "#9E9E8F", cursor: "pointer", fontWeight: commentType === t ? 600 : 400, textTransform: "capitalize" }}>{t}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea placeholder="Leave feedback…" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => (e.metaKey || e.ctrlKey) && e.key === "Enter" && postComment()} rows={2} style={{ flex: 1, padding: "10px 12px", fontSize: 14, borderRadius: 10, border: "1px solid #E8E6DE", background: "#FAFAF6", color: "#2C2B26", outline: "none", resize: "none", fontFamily: "inherit" }} />
              <button onClick={postComment} disabled={!commentText.trim()} style={{ alignSelf: "flex-end", padding: "10px 18px", fontSize: 14, fontWeight: 600, borderRadius: 10, border: "none", background: commentText.trim() ? "#3B82F6" : "#E8E6DE", color: commentText.trim() ? "#fff" : "#B5B3AA", cursor: commentText.trim() ? "pointer" : "default" }}>Post</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 20 }}>
            <button onClick={() => approveFile(file.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: 14, border: `2px solid ${file.is_final ? "#A5D6A7" : "#C8E6C9"}`, background: file.is_final ? "#C8E6C9" : "#E8F5E9", color: "#2E7D32", cursor: "pointer" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              {file.is_final ? "Approved ✓" : "Approve"}
            </button>
            <button onClick={goBack} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", fontSize: 15, fontWeight: 700, borderRadius: 14, border: "2px solid #FFCDD2", background: "#FFEBEE", color: "#C62828", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              Revise
            </button>
          </div>
        </div>
      )}

      <BottomNav tab={tab} onTab={t => { setTab(t); if (t === "projects") { setScreen("projects"); setActiveProjectId(null); setActiveFileId(null); } }} />
      {showShare && project && <ShareModal project={project} onClose={() => setShowShare(false)} />}
    </div>
  );
}