import { runtime } from "@/server/runtime.mjs";
import { sessionFor } from "@/server/session";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!sessionFor(req)) return Response.json({ detail: "Sign in first." }, { status: 401 });
  const rt = runtime();const enc = new TextEncoder();let timer: ReturnType<typeof setInterval>;let ctrl: ReadableStreamDefaultController<Uint8Array>;
  const close = () => {clearInterval(timer);rt.streams.delete(ctrl);try {ctrl.close();} catch {}};
  const stream = new ReadableStream<Uint8Array>({ start(c) {ctrl = c;c.enqueue(enc.encode('retry: 3000\n\ndata: {"type":"hello"}\n\n'));rt.streams.add(c);timer = setInterval(() => {if (!sessionFor(req)) {close();return;}try {c.enqueue(enc.encode(": ping\n\n"));} catch {close();}}, 20000);req.signal.addEventListener("abort", close);}, cancel() {close();} });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
