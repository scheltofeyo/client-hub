import { redirect } from "next/navigation";

export default async function ResultsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tools/surveys/${id}?tab=results`);
}
