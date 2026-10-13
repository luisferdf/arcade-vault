"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../_components/AuthProvider";
import {
  authErrorMessage,
  normalizeUsername,
  validateUsername,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

export default function NombrePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/auth");
    else if (user.username) router.replace("/");
  }, [loading, user, router]);

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !user) return;
    setError(null);
    const name = normalizeUsername(username);
    const nameError = validateUsername(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data: free, error: rpcError } = await supabase.rpc(
      "username_available",
      { p_username: name },
    );
    if (rpcError) {
      setError(authErrorMessage(rpcError));
      setBusy(false);
      return;
    }
    if (!free) {
      setError("NOMBRE EN USO, ELIGE OTRO");
      setBusy(false);
      return;
    }
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: name });
    if (insertError) {
      // 23505: otro jugador tomó el nombre entre la comprobación y el insert.
      setError(
        insertError.code === "23505"
          ? "NOMBRE EN USO, ELIGE OTRO"
          : authErrorMessage(insertError),
      );
      setBusy(false);
      return;
    }
    // Recarga completa: el AuthProvider vuelve a leer el perfil recién creado.
    window.location.assign("/");
  };

  if (loading || !user || user.username) return null;

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ELIGE TU NOMBRE</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ASÍ APARECERÁS EN EL SALÓN DE LA FAMA
          </div>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="nombre-username">Nombre de jugador</label>
            <input
              id="nombre-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="PX_KAI"
              maxLength={10}
              autoComplete="username"
              autoCapitalize="characters"
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-faint)", marginBottom: 8 }}
          >
            3–10 CARACTERES · A-Z 0-9 _
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
            {busy ? "GUARDANDO…" : "CONFIRMAR NOMBRE"}
          </button>
        </form>
      </div>
    </div>
  );
}
