import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportFirePage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Report a fire",
  description: "Report a fire with photo, location and description"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportFirePage />
    </Suspense>);

}
