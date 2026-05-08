import { Resend } from "resend";
import type { ReactElement } from "react";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

let resendInstance: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendInstance) resendInstance = new Resend(key);
  return resendInstance;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM;
  const client = getClient();

  if (!client || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[email] DEV stub — no RESEND_API_KEY/EMAIL_FROM, skipping send to ${Array.isArray(opts.to) ? opts.to.join(", ") : opts.to}: "${opts.subject}"`
      );
      return { ok: true };
    }
    return { ok: false, error: "Email not configured (missing RESEND_API_KEY or EMAIL_FROM)" };
  }

  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO;

  try {
    const { data, error } = await client.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      react: opts.react,
      replyTo,
      tags: opts.tags,
    });
    if (error) return { ok: false, error: error.message ?? String(error) };
    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
