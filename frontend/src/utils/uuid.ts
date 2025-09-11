function generateUuidV4(): string {
  // Use crypto API for secure random UUID
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  // https://stackoverflow.com/a/2117523/65387
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  const key = "doctorIntakeSessionId";
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateUuidV4();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
} 