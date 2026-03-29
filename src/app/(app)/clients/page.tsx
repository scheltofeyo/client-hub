import { getClients, getClientStatuses, getClientPlatforms } from "@/lib/data";
import { auth } from "@/auth";
import ClientsPageClient from "./ClientsPageClient";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const [clients, statuses, platforms, session] = await Promise.all([
    getClients(),
    getClientStatuses(),
    getClientPlatforms(),
    auth(),
  ]);

  return (
    <ClientsPageClient
      clients={clients}
      currentUserId={session?.user?.id ?? null}
      statuses={statuses}
      platforms={platforms}
    />
  );
}
