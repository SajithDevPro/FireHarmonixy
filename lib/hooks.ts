"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "./api";
import { useApp } from "@/components/providers";



export function useApi<T = any>(path: string | null, opts: {poll?: number;skip?: boolean;} = {}) {
  const { poll = 0, skip = false } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [nonce, setNonce] = useState(0);
  const { generation } = useApp();

  useEffect(() => {
    if (skip || !path) {setLoading(false);return;}
    let live = true;
    const ctrl = new AbortController();
    setLoading(true);
    api.get<T>(path, ctrl.signal).
    then((d) => {if (live) {setData(d);setError(null);setLoading(false);}}).
    catch((e: any) => {
      if (live && e.name !== "AbortError") {setError(e.message || "Request failed");setLoading(false);}
    });
    let id: ReturnType<typeof setInterval> | null = null;
    if (poll) id = setInterval(() => {
      api.get<T>(path).then((d) => {if (live) setData(d);}).catch((e: any) => {if (live) setError(e.message);});
    }, poll);
    return () => {live = false;ctrl.abort();if (id) clearInterval(id);};
  }, [path, skip, poll, nonce, generation]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}


export function useAction() {
  const { toast } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (fn: () => Promise<any>, opts: {success?: string;then?: (r: any) => void;} = {}) => {
    setBusy(true);
    try {
      const r = await fn();
      if (opts.success) toast(opts.success, "ok");
      if (opts.then) opts.then(r);
      return r;
    } catch (e: any) {
      const msg = e?.message || "Request failed";
      toast(msg, "bad");
      if (/401|token/i.test(msg)) router.push("/settings");
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast, router]);

  return { busy, run };
}
