import type { Metadata } from "next";
import { Suspense } from "react";
import { HospitalsPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Hospitals",
  description: "Hospitals and emergency cover"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HospitalsPage />
    </Suspense>);

}
