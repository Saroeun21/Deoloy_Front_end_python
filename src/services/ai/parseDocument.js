import { resolveApiUrl } from "../api/httpClient.js";

function responseError(body) {
  if (!body) return "Document processing failed.";
  try {
    const parsed = JSON.parse(body);
    return typeof parsed.detail === "string"
      ? parsed.detail
      : JSON.stringify(parsed.detail ?? parsed);
  } catch {
    return body;
  }
}

export async function parseDocument(file, tripId) {
  if (!(file instanceof File)) {
    throw new Error("Choose a document or image to upload.");
  }
  if (!tripId) {
    throw new Error("Select a trip before uploading a travel document.");
  }
  const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Upload a PDF, JPEG, PNG, or WebP file.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The upload is too large. Maximum file size is 10 MB.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("trip_id", String(tripId));
  const token = localStorage.getItem("accessToken");
  let response;
  try {
    response = await fetch(resolveApiUrl("/api/v1/ai/parse-document"), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`Could not reach the TripOS document parser.${detail}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Document parser request failed (HTTP ${response.status}): ${responseError(body)}`,
    );
  }
  const result = await response.json();
  const parsed = result.parsed ?? result.extraction ?? result;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The document parser returned an invalid response.");
  }
  for (const key of ["booking", "expense", "reminder"]) {
    if (parsed[key] != null && (typeof parsed[key] !== "object" || Array.isArray(parsed[key]))) {
      throw new Error(`The document parser returned an invalid ${key}.`);
    }
  }
  return parsed;
}

export default parseDocument;
