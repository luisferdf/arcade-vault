"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../_components/AuthProvider";
import { MIN_PASSWORD_LENGTH, authErrorMessage } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [pass, setPass] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Requiere la sesión de recuperación que crea /auth/callback.
  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [loading, user, router]);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (pass.length < MIN_PASSWORD_LENGTH) {
      setError("LA CONTRASEÑA DEBE TENER AL MENOS 8 CARACTERES");
      return;
    }
    if (pass !== repeat) {
      setError("LAS CONTRASEÑAS NO COINCIDEN");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: pass });
    setBusy(false);
    if (err) {
      setError(
        err.code === "same_password"
          ? "LA NUEVA CONTRASEÑA DEBE SER DISTINTA A LA ANTERIOR"
          : authErrorMessage(err),
      );
      return;
    }
    router.push("/");
    router.refresh();
  };

  if (loading || !user) return null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="np-pass">Nueva contraseña</label>
            <input
              id="np-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="np-repeat">Repetir contraseña</label>
            <input
              id="np-repeat"
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
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
            {busy ? "GUARDANDO…" : "FIJAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
