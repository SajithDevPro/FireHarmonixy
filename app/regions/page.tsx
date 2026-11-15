import type { Metadata } from "next";
import { Suspense } from "react";
import { RegionsPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Countries and regions",
  description: "Platform geography"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegionsPage />
    </Suspense>);

}
