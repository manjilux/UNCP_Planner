// Session ID for favorites/notes (persisted in localStorage)
export function getSessionId(): string {
  let id = localStorage.getItem("uncp-session-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("uncp-session-id", id);
  }
  return id;
}
