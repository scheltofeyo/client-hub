import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SUMM - Spin the Wheel",
};

export default function SpinTheWheelLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50">{children}</div>;
}
