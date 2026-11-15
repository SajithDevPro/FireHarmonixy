import type { Metadata } from "next";
import { Suspense } from "react";
import { CivicDashboard } from "@/components/pages/civic";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Role-shaped overview of your area"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CivicDashboard />
    </Suspense>);

}
