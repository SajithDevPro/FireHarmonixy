import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { AuthProvider } from "@/lib/auth";
import { Shell } from "@/components/shell";

export const metadata: Metadata = {
  title: { default: "Overview", template: "%s · FireHarmonix" },
  description: "FireHarmonix — satellite thermal-detection analysis and hazard monitoring",
  icons: {
    icon: [
    {
      url:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23d2691e'/%3E%3Cpath d='M16 6c2.6 5 6 6.2 6 11a6 6 0 1 1-12 0c0-2.4 1.2-4.2 2.5-5.4.5 2 1.5 2.7 2.5 3-.8-3-.5-6.2 1-8.6z' fill='%23fff'/%3E%3C/svg%3E"
    }]

  }
};

export default function RootLayout({ children }: {children: React.ReactNode;}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <AppProvider>
            <Shell>{children}</Shell>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>);

}
