/**
 * Upload a file to S3 via presigned URL.
 * 1. Request presigned URL from our API
 * 2. PUT the file directly to S3
 * 3. Return the file record
 *
 * @param {File} file - The file to upload
 * @param {string} projectId - The project to attach it to
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {object} The created file record
 */
export async function uploadFile(file, projectId, onProgress) {
  // Step 1: Get presigned URL from our API
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to get upload URL");
  }

  const { file: fileRecord, uploadUrl } = await res.json();

  // Step 2: Upload directly to S3 with progress tracking
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });

  // Step 3: Return the file record
  return fileRecord;
}

/**
 * Upload multiple files with individual progress tracking.
 *
 * @param {FileList|File[]} files
 * @param {string} projectId
 * @param {function} onFileProgress - (fileIndex, percent)
 * @returns {object[]} Array of created file records
 */
export async function uploadFiles(files, projectId, onFileProgress) {
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const record = await uploadFile(files[i], projectId, (percent) => {
      onFileProgress?.(i, percent);
    });
    results.push(record);
  }

  return results;
}
