import type { Metadata } from "next";
import { Suspense } from "react";
import { IncidentsPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Incidents",
  description: "Reports and their review state"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <IncidentsPage />
    </Suspense>);

}
