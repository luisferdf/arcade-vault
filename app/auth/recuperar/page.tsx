"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { authErrorMessage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!email.trim()) {
      setError("ESCRIBE TU CORREO ELECTRÓNICO");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/nueva-contrasena`,
      },
    );
    setBusy(false);
    // Solo se muestran los errores de límite/servicio; exista o no el correo la
    // respuesta es la misma, para no revelar qué emails están registrados.
    if (
      err &&
      (err.code === "over_email_send_rate_limit" ||
        err.code === "over_request_rate_limit")
    ) {
      setError(authErrorMessage(err));
      return;
    }
    setSent(true);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">RECUPERAR CONTRASEÑA</h2>
        </div>

        {sent ? (
          <p
            className="mono"
            role="status"
            style={{ fontSize: 12, lineHeight: 1.7, textAlign: "center" }}
          >
            SI EL CORREO EXISTE, TE ENVIAMOS UN ENLACE PARA FIJAR UNA NUEVA
            CONTRASEÑA.
          </p>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="rec-email">Correo electrónico</label>
              <input
                id="rec-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
              />
            </div>
            {error && (
              <div
                className="contact-error"
                role="alert"
                style={{ marginTop: 4 }}
              >
                {error}
              </div>
            )}
            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <Link
          href="/auth"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10, textAlign: "center" }}
        >
          VOLVER A INICIAR SESIÓN
        </Link>
      </div>
    </div>
  );
}
