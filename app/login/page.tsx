import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPage } from "@/components/pages/login";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to FireHarmonix"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>);

}
