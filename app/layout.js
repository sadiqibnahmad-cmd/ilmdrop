export const metadata = {
  title: "ilmDrop",
  description: "Upload, share, and review media files with your team",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}