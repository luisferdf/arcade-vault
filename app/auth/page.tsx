"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type SyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  authErrorMessage,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type Tab = "in" | "up";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    params.get("error") === "callback"
      ? "EL ENLACE NO ES VÁLIDO O YA EXPIRÓ. INTÉNTALO DE NUEVO"
      : null,
  );
  // Correo al que se envió la confirmación (pantalla "REVISA TU CORREO").
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  // El botón "Iniciar Sesión" del Nav vuelve al formulario de entrada.
  useEffect(() => {
    const reset = () => {
      setPendingEmail(null);
      setResendMsg(null);
      setError(null);
      setEmailError(null);
      setPassError(null);
      setTab("in");
    };
    window.addEventListener("av:auth-reset", reset);
    return () => window.removeEventListener("av:auth-reset", reset);
  }, []);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setEmailError(null);
    setPassError(null);
  };

  // Valida email (y contraseña si fija una nueva) antes de llamar a Supabase.
  const validateFields = (): boolean => {
    const emailErr = validateEmail(email);
    const passErr =
      tab === "up"
        ? validatePassword(pass)
        : pass
          ? null
          : "ESCRIBE TU CONTRASEÑA";
    setEmailError(emailErr);
    setPassError(passErr);
    return !emailErr && !passErr;
  };

  const signIn = async () => {
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    router.push("/");
    router.refresh();
  };

  const signUp = async () => {
    const name = normalizeUsername(username);
    const nameError = validateUsername(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    const supabase = createClient();
    const { data: free, error: rpcError } = await supabase.rpc(
      "username_available",
      { p_username: name },
    );
    if (rpcError) {
      setError(authErrorMessage(rpcError));
      return;
    }
    if (!free) {
      setError("NOMBRE EN USO, ELIGE OTRO");
      return;
    }

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: {
        data: { username: name },
        emailRedirectTo: callbackUrl(),
      },
    });
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    // Con confirmación por correo, Supabase no da error si el correo ya existe:
    // devuelve un usuario falso sin identities y no envía nada.
    if (data.user?.identities?.length === 0) {
      setError("ESTE CORREO YA ESTÁ REGISTRADO. INICIA SESIÓN");
      return;
    }
    setPendingEmail(email.trim());
  };

  const submit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!validateFields()) return;
    setBusy(true);
    try {
      if (tab === "in") await signIn();
      else await signUp();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!pendingEmail || busy) return;
    setBusy(true);
    setResendMsg(null);
    const supabase = createClient();
    // Supabase no reenvía (ni avisa) si la cuenta ya está confirmada: si la
    // contraseña entra, ya estaba confirmada.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: pendingEmail,
      password: pass,
    });
    if (!signInErr) {
      router.push("/");
      router.refresh();
      return;
    }
    if (signInErr.code !== "email_not_confirmed") {
      setResendMsg(authErrorMessage(signInErr));
      setBusy(false);
      return;
    }
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: callbackUrl() },
    });
    setResendMsg(err ? authErrorMessage(err) : "CORREO REENVIADO");
    setBusy(false);
  };

  const signInOAuth = async (provider: "google" | "github") => {
    if (busy) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    // Si no hay error el navegador ya está yendo al proveedor.
    if (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  };

  const playAsGuest = () => {
    router.push("/");
  };

  if (pendingEmail) {
    return (
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">REVISA TU CORREO</h2>
        </div>
        <p
          className="mono"
          style={{ fontSize: 12, lineHeight: 1.7, textAlign: "center" }}
        >
          TE ENVIAMOS UN ENLACE DE CONFIRMACIÓN A{" "}
          <span className="neon-cyan">{pendingEmail}</span>. ÁBRELO PARA ACTIVAR
          TU CUENTA Y ENTRAR AL VAULT.
        </p>
        {resendMsg && (
          <div
            className="contact-error"
            role="status"
            style={{ marginTop: 12, textAlign: "center" }}
          >
            {resendMsg}
          </div>
        )}
        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={resend}
          disabled={busy}
        >
          REENVIAR CORREO
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            setPendingEmail(null);
            setResendMsg(null);
            switchTab("in");
          }}
        >
          INICIAR SESIÓN
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark" />
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
            marginTop: 6,
          }}
        >
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>

      <div className="auth-tabs">
        <button
          type="button"
          className={tab === "in" ? "on" : ""}
          onClick={() => switchTab("in")}
        >
          INICIAR SESIÓN
        </button>
        <button
          type="button"
          className={tab === "up" ? "on" : ""}
          onClick={() => switchTab("up")}
        >
          CREAR CUENTA
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        {tab === "up" && (
          <div className="field slide-in">
            <label htmlFor="auth-username">Nombre de jugador</label>
            <input
              id="auth-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="PX_KAI"
              maxLength={10}
              autoComplete="username"
              autoCapitalize="characters"
              style={{ textTransform: "uppercase" }}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Correo electrónico</label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            placeholder="jugador@vault.gg"
            autoComplete="email"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "auth-email-error" : undefined}
            required
          />
          {emailError && (
            <div id="auth-email-error" className="contact-error" role="alert">
              {emailError}
            </div>
          )}
        </div>
        <div className="field">
          <label htmlFor="auth-pass">Contraseña</label>
          <input
            id="auth-pass"
            type="password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setPassError(null);
            }}
            placeholder="••••••••"
            autoComplete={tab === "in" ? "current-password" : "new-password"}
            aria-invalid={!!passError}
            aria-describedby={passError ? "auth-pass-error" : undefined}
            required
          />
          {passError && (
            <div id="auth-pass-error" className="contact-error" role="alert">
              {passError}
            </div>
          )}
        </div>

        {tab === "in" && (
          <div style={{ textAlign: "right", marginBottom: 8 }}>
            <Link
              href="/auth/recuperar"
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              ¿OLVIDASTE TU CONTRASEÑA?
            </Link>
          </div>
        )}

        {error && (
          <div className="contact-error" role="alert" style={{ marginTop: 4 }}>
            {error}
          </div>
        )}

        <button
          className="btn lg"
          type="submit"
          disabled={busy}
          style={{ width: "100%", marginTop: 8 }}
        >
          {busy
            ? "PROCESANDO…"
            : tab === "in"
              ? "ENTRAR AL VAULT"
              : "CREAR CUENTA"}
        </button>
      </form>

      <button
        type="button"
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={playAsGuest}
      >
        JUGAR COMO INVITADO
      </button>

      <div className="auth-divider">O CONTINÚA CON</div>
      <div className="social">
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => signInOAuth("google")}
        >
          ◆ GOOGLE
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={busy}
          onClick={() => signInOAuth("github")}
        >
          ▣ GITHUB
        </button>
      </div>

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.1em",
        }}
      >
        AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
