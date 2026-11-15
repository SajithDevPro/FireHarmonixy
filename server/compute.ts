export async function compute(req: Request, pathname: string): Promise<Response> {
  const origin = process.env.FIREFUSE_ENGINE_ORIGIN;
  const token = process.env.FIREFUSE_ADMIN_TOKEN;
  if (!origin || !token) return Response.json({ detail: "Engine connection is not configured." }, { status: 503 });
  const upstream = new URL(origin);
  upstream.pathname = pathname;
  upstream.search = new URL(req.url).search;
  const headers = new Headers();
  for (const key of ["content-type", "accept", "range", "last-event-id"]) {
    const v = req.headers.get(key);if (v) headers.set(key, v);
  }
  headers.set("X-Admin-Token", token);
  try {
    const init: RequestInit & {duplex?: string;} = { method: req.method, headers, cache: "no-store", redirect: "manual", signal: req.signal };
    if (!["GET", "HEAD"].includes(req.method)) {init.body = req.body;init.duplex = "half";}
    const r = await fetch(upstream, init);
    const out = new Headers(r.headers);
    for (const h of ["content-encoding", "content-length", "connection", "transfer-encoding"]) out.delete(h);
    out.set("Cache-Control", "no-store");
    return new Response(r.body, { status: r.status, headers: out });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ detail: "The compute service is unavailable. Check the backend logs." }, { status: 502 });
  }
}
