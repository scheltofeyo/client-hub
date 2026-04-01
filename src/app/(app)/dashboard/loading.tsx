import LoadingThinking from "@/components/ui/LoadingThinking";

export default function DashboardLoading() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
      <LoadingThinking />
    </div>
  );
}
