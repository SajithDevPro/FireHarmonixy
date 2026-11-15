import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfilePage } from "@/components/pages/account";

export const metadata: Metadata = {
  title: "Profile settings",
  description: "Your account, notifications, password and signed-in devices"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>);

}
