








const BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

function adminToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("fireharmonix.token") || "";
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") return body.detail;
  } catch (e) {}
  return `Request failed (HTTP ${res.status})`;
}

const authHeader = (): Record<string, string> => adminToken() ? { "X-Admin-Token": adminToken() } : {};

export async function get<T = any>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal, headers: { Accept: "application/json", ...authHeader() } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function post<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json().catch(() => ({}) as T);
}

export async function del<T = any>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { method: "DELETE", headers: authHeader() });
  if (!res.ok) throw new Error(await readError(res));
  return res.json().catch(() => ({}) as T);
}

export const api = { get, post, delete: del };
export default api;
