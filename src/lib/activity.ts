import { connectDB } from "@/lib/mongodb";
import { ActivityEventModel } from "@/lib/models/ActivityEvent";
import { activeTokenName } from "@/lib/api-token";

export async function recordActivity(event: {
  clientId: string;
  actorId: string;
  actorName: string;
  type: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDB();

    // When the request came in over an API token the actor is still the real
    // person who owns it, so we stamp the channel onto the event instead of
    // inventing a bot actor. Read here rather than threading a parameter
    // through all ~35 call sites.
    const viaToken = await activeTokenName();

    await ActivityEventModel.create({
      clientId: event.clientId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: event.type,
      metadata: viaToken
        ? { ...(event.metadata ?? {}), via: "api", viaTokenName: viaToken }
        : (event.metadata ?? {}),
    });
  } catch {
    // Activity recording is non-critical — never let it break the main request
  }
}
