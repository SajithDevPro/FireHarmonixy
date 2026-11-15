import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertsPage } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Stay Alert",
  description: "Local alerts and notifications"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AlertsPage />
    </Suspense>);

}
