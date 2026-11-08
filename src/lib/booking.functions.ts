import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHost, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const COOKIE = "dh_booking_origin";
const bookingInput = z.object({
  slug: z.string().min(1).max(80),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  name: z.string().max(120),
  phone: z.string().max(40),
  vehicleModel: z.string().max(80),
  plate: z.string().max(20),
  notes: z.string().max(1000),
  requestKey: z.string().uuid(),
  turnstileToken: z.string().min(1).max(2048),
});

export const getBookingProtectionConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { siteKey: process.env["TURNSTILE_SITE_KEY"] ?? null };
});

export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingInput.parse(input))
  .handler(async ({ data }) => {
    const turnstileSecret = process.env["TURNSTILE_SECRET_KEY"];
    const cookieSecret = process.env["BOOKING_COOKIE_SECRET"];
    if (!turnstileSecret || !cookieSecret || !process.env["TURNSTILE_SITE_KEY"]) {
      return { error: "PROTECAO_NAO_CONFIGURADA" as const };
    }

    const host = getRequestHost().split(":")[0]?.toLowerCase();
    const verification = await verifyTurnstile(turnstileSecret, data.turnstileToken);
    if (
      !verification.success ||
      verification.action !== "booking" ||
      verification.hostname?.toLowerCase() !== host
    ) {
      return { error: "VERIFICACAO_FALHOU" as const };
    }

    let subject = await readSignedSubject(getCookie(COOKIE), cookieSecret);
    if (!subject) {
      subject = crypto.randomUUID();
      setCookie(COOKIE, await signSubject(subject, cookieSecret), {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    const originHash = await sha256Hex(`${cookieSecret}:${subject}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("submit_verified_booking", {
      _origin_hash: originHash,
      _slug: data.slug,
      _service_id: data.serviceId,
      _starts_at: data.startsAt,
      _name: data.name,
      _phone: data.phone,
      _vehicle_model: data.vehicleModel,
      _plate: data.plate,
      _notes: data.notes,
      _request_key: data.requestKey,
    });
    if (error) {
      console.error("Booking submission failed", error.message);
      return { error: "FALHA_TEMPORARIA" as const };
    }
    return result as { id?: string; error?: string };
  });

async function verifyTurnstile(secret: string, token: string) {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) return { success: false };
    return (await response.json()) as { success?: boolean; action?: string; hostname?: string };
  } catch {
    return { success: false };
  }
}

async function signSubject(subject: string, secret: string) {
  return `${subject}.${await hmacHex(subject, secret)}`;
}

async function readSignedSubject(value: string | undefined, secret: string) {
  const [subject, signature] = value?.split(".") ?? [];
  if (!subject || !signature || !z.string().uuid().safeParse(subject).success) return null;
  const expected = await hmacHex(subject, secret);
  return timingSafeEqual(expected, signature) ? subject : null;
}

async function hmacHex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function sha256Hex(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
