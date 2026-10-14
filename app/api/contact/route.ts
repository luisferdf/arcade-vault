import { Resend } from "resend";

interface ContactRequestBody {
  name: string;
  email: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS = { name: 60, email: 254, message: 2000 } as const;

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de la petición inválido." },
      { status: 400 },
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return Response.json(
      { ok: false, error: "Cuerpo de la petición inválido." },
      { status: 400 },
    );
  }
  const body = raw as Record<string, unknown>;

  if (
    typeof body.name !== "string" ||
    typeof body.email !== "string" ||
    typeof body.message !== "string"
  ) {
    return Response.json(
      { ok: false, error: "Nombre, correo y mensaje son obligatorios." },
      { status: 400 },
    );
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const message = body.message.trim();

  if (!name || !email || !message) {
    return Response.json(
      { ok: false, error: "Nombre, correo y mensaje son obligatorios." },
      { status: 400 },
    );
  }

  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    message.length > LIMITS.message
  ) {
    return Response.json(
      {
        ok: false,
        error: `Texto demasiado largo (máx. ${LIMITS.name} nombre, ${LIMITS.email} correo, ${LIMITS.message} mensaje).`,
      },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "El correo electrónico no es válido." },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, error: "El servicio de correo no está configurado." },
      { status: 500 },
    );
  }

  const resend = new Resend(apiKey);

  const subjectName = name.replace(/[\r\n]+/g, " ");

  try {
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "luisfernandodiazfernandez@gmail.com",
      subject: `Arcade Vault: mensaje de ${subjectName}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${message}`,
    });

    if (error) {
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje." },
        { status: 500 },
      );
    }
  } catch {
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje." },
      { status: 500 },
    );
  }

  return Response.json({ ok: true });
}
