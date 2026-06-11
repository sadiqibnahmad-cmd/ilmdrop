export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#F5F4EF",
        color: "#2C2B26",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "#3B82F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px" }}>
        MediaDrop
      </h1>
      <p style={{ fontSize: 16, color: "#7A796F", margin: "0 0 32px", maxWidth: 400 }}>
        Upload, share, and review media files with your clients and team.
      </p>
      <p style={{ fontSize: 14, color: "#B5B3AA" }}>
        API is running. Connect your frontend to get started.
      </p>
    </div>
  );
}