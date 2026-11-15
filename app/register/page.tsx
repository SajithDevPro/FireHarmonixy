import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterPage } from "@/components/pages/register";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Request a FireHarmonix account — read-only until an administrator raises the role"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegisterPage />
    </Suspense>);

}
