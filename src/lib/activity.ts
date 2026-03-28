import { connectDB } from "@/lib/mongodb";
import { ActivityEventModel } from "@/lib/models/ActivityEvent";

export async function recordActivity(event: {
  clientId: string;
  actorId: string;
  actorName: string;
  type: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await connectDB();
    await ActivityEventModel.create({
      clientId: event.clientId,
      actorId: event.actorId,
      actorName: event.actorName,
      type: event.type,
      metadata: event.metadata ?? {},
    });
  } catch {
    // Activity recording is non-critical — never let it break the main request
  }
}
