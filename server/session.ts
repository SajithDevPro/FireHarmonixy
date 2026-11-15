import { runtime } from "./runtime.mjs";
export function tokenFor(req: Request): string {
  const header = req.headers.get("x-admin-token") || req.headers.get("authorization") || "";
  if (header) return header.replace(/^Bearer\s+/i, "").trim();
  const cookie = (req.headers.get("cookie") || "").split(";").map((x) => x.trim()).find((x) => x.startsWith("fh_session="));
  return cookie ? decodeURIComponent(cookie.slice("fh_session=".length)) : "";
}
export function sessionFor(req: Request): any {
  const rt = runtime();
  const token = tokenFor(req);
  const s = rt.state.sessions[token];
  if (!s || Date.parse(s.expires) <= Date.now()) return null;
  const user = rt.state.users.find((u: any) => u.id === s.user);
  return user && !user.disabled ? { token, user, session: s } : null;
}
export function scientificAccess(req: Request): Response | null {
  const s = sessionFor(req);
  if (!s) return Response.json({ detail: "Sign in before opening the scientific workspace." }, { status: 401 });
  if (s.user.roleCode !== "SUPER_ADMIN") return Response.json({ detail: "Global scientific data is restricted to the central administrator. Your civic records remain scoped to your role." }, { status: 403 });
  return null;
}
