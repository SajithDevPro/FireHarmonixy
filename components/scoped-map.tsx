"use client";

import CivicMap, { scopeCenterFor, type MapPoint } from "@/components/civic-map";
import { Card, Chip, ErrorBox, Loading, PageHead } from "@/components/ui";
import { useApi } from "@/lib/hooks";
import { useCaps } from "@/lib/civic";

function isLocated(row: any) {
  return row.lat !== null && row.lat !== undefined && row.lon !== null && row.lon !== undefined &&
    Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lon));
}

export function ScopedMap({ showAccounts = false }: {showAccounts?: boolean;}) {
  const caps = useCaps();
  const incidents = useApi<any>(showAccounts ? null : "/api/incidents", { skip: showAccounts, poll: 30000 });
  const hospitals = useApi<any>(showAccounts ? null : "/api/hospitals", { skip: showAccounts, poll: 30000 });
  const routes = useApi<any>(showAccounts ? null : "/api/routes", { skip: showAccounts, poll: 30000 });
  const accounts = useApi<any>(showAccounts ? "/api/users" : null, { skip: !showAccounts });
  const scope = caps?.scope;
  const center = scopeCenterFor(scope?.country, scope?.district);
  const recordPoints: MapPoint[] = [
    ...(incidents.data?.incidents || []).filter(isLocated).map((row: any) => ({
      id: row.id, lat: Number(row.lat), lon: Number(row.lon), label: row.title,
      tone: "var(--bad)", kind: "incident" as const, sub: row.status
    })),
    ...(hospitals.data?.hospitals || []).filter(isLocated).map((row: any) => ({
      id: row.id, lat: Number(row.lat), lon: Number(row.lon), label: row.name,
      tone: "var(--teal)", kind: "hospital" as const
    })),
    ...(routes.data?.routes || []).filter(isLocated).map((row: any) => ({
      id: row.id, lat: Number(row.lat), lon: Number(row.lon), label: row.title,
      tone: "var(--info)", kind: "route" as const
    }))
  ];
  const accountPoints: MapPoint[] = (accounts.data?.users || []).flatMap((user: any) => {
    const location = scopeCenterFor(user.country, user.district);
    return location ? [{
      id: user.id, ...location, label: `${user.name} · ${user.role}`,
      tone: "var(--violet)", kind: "property" as const, sub: [user.district, user.country].filter(Boolean).join(" · ")
    }] : [];
  });
  const points = showAccounts ? accountPoints : recordPoints;

  const errors = (showAccounts ? [accounts.error] : [incidents.error, hospitals.error, routes.error]).
    filter((error): error is string => !!error);
  const loading = showAccounts ? accounts.loading : incidents.loading || hospitals.loading || routes.loading;
  const where = [scope?.district, scope?.country].filter(Boolean).join(" · ") || "your assigned area";
  const mapCenter = showAccounts ? { lat: 0, lon: 0 } : center;
  const spanKm = showAccounts ? 40000 : scope?.district ? 300 : scope?.country ? 1200 : 4000;

  return (
    <div>
      <PageHead
        title={showAccounts ? "Account locations" : "Live map"}
        subtitle={showAccounts ?
        "Approximate assigned areas for accounts on this installation." :
        "Incidents, hospitals and evacuation routes visible to your account."} />
      {errors.map((error) => <ErrorBox key={error} error={error} />)}
      <Card
        title={showAccounts ? "Account scopes" : where}
        subtitle={showAccounts ?
        "Markers use assigned country or district centres, not precise home locations." :
        "Records are filtered by your role and assigned area. Resident properties are never shown."}>
        {loading && !points.length ? <Loading text="Loading your area…" /> : null}
        <CivicMap
          points={points}
          center={mapCenter}
          spanKm={spanKm}
          height={480}
          caption={showAccounts ? "Approximate assigned-area locations" : `${where} · approximate area centre`}
        />
        {showAccounts ?
        <div className="mt-4">
            <h3 className="mb-2">Mapped accounts</h3>
            <ul className="civic-list">
              {accountPoints.map((point) =>
              <li key={point.id}>
                  <div className="civic-list-main">
                    <span className="civic-link">{point.label}</span>
                    <span className="civic-sub">{point.sub}</span>
                  </div>
                </li>
              )}
            </ul>
          </div> :
        null}
        {showAccounts ?
        <div className="flex flex-wrap gap-3 mt-3">
            <Chip label={`Accounts mapped · ${accountPoints.length}`} color="var(--violet)" />
          </div> :
        <div className="flex flex-wrap gap-3 mt-3">
          <Chip label={`Incidents · ${incidents.data?.incidents?.length ?? 0}`} color="var(--bad)" />
          <Chip label={`Hospitals · ${hospitals.data?.hospitals?.length ?? 0}`} color="var(--teal)" />
          <Chip label={`Evacuation routes · ${routes.data?.routes?.length ?? 0}`} color="var(--info)" />
          </div>}
      </Card>
    </div>
  );
}
