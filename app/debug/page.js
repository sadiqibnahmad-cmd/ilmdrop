export default function DebugPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    <div style={{ padding: 40, fontFamily: "monospace", fontSize: 14, lineHeight: 2, background: "#f5f5f5", minHeight: "100vh" }}>
      <h2>Env Debug</h2>
      <p><strong>NEXT_PUBLIC_SUPABASE_URL:</strong> {url || "❌ MISSING"}</p>
      <p><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong> {key ? `✅ starts with: ${key.slice(0, 20)}...` : "❌ MISSING"}</p>
    </div>
  );
}