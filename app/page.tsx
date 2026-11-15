import type { Metadata } from "next";
import { HomePage } from "@/components/pages/home";

export const metadata: Metadata = {
  title: { absolute: "FireHarmonix — every detection, with its evidence attached" },
  description:
  "Satellite thermal detections, the candidate events built from them, fourteen years of record and the models in front of them — with the evidence attached to every number."
};

export default function Home() {
  return <HomePage />;
}
