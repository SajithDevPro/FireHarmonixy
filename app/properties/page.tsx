import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertiesPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "My properties",
  description: "Private home and farm locations"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PropertiesPage />
    </Suspense>);

}
