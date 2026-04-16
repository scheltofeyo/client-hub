export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col" style={{ background: "hsl(263 70% 98%)" }}>
      {children}
    </div>
  );
}
