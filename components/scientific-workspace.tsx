"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { ScopedMap } from "@/components/scoped-map";
export function ScientificWorkspace({ page }: {page: string;}) {
  const { ready, user } = useAuth();
  const [mapView, setMapView] = useState<"fires" | "accounts">("fires");
  if (!ready) return <div className="page">Checking your session…</div>;
  if (!user) return <div className="page">Sign in to open analysis.</div>;
  if (user.roleCode !== "SUPER_ADMIN") {
    return page === "map" ? <ScopedMap /> : <div className="page">Global satellite analysis is available to the central administrator. Your incident and response records remain scoped to your role.</div>;
  }
  if (page === "map") {
    return (
      <section style={{ height: "calc(100vh - 110px)", minHeight: 600, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", gap: 8, padding: "8px 12px" }}>
          <button className={"btn" + (mapView === "fires" ? " btn-primary" : "")} aria-pressed={mapView === "fires"} onClick={() => setMapView("fires")}>Fire activity</button>
          <button className={"btn" + (mapView === "accounts" ? " btn-primary" : "")} aria-pressed={mapView === "accounts"} onClick={() => setMapView("accounts")}>Account locations</button>
        </div>
        {mapView === "accounts" ?
        <div style={{ flex: 1, overflow: "auto" }}><ScopedMap showAccounts /></div> :
        <iframe key={page} title="Live scientific analysis workspace" src={"/engine-ui/#/" + encodeURIComponent(page)} style={{ width: "100%", flex: 1, minHeight: 0, border: 0, display: "block" }} />}
      </section>
    );
  }
  return <section style={{ height: "calc(100vh - 110px)", minHeight: 600 }}>
 <iframe key={page} title="Live scientific analysis workspace" src={"/engine-ui/#/" + encodeURIComponent(page)} style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
 </section>;
}
