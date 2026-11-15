import type { Metadata } from "next";
import { Suspense } from "react";
import { RoutesPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Evacuation routes",
  description: "Which ways out are usable"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RoutesPage />
    </Suspense>);

}
