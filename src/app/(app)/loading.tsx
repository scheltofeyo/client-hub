import BrandLoader from "@/components/ui/BrandLoader";

export default function AppLoading() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
      <BrandLoader />
    </div>
  );
}
