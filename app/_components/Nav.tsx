"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser, setStoredUser, USER_CHANGED_EVENT, type StoredUser } from "@/lib/auth";

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const onChange = () => setUser(getStoredUser());
    window.addEventListener(USER_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(USER_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isInicio = pathname === "/";
  const isBiblioteca = pathname === "/biblioteca" || pathname.startsWith("/juego");
  const isSalon = pathname === "/salon";
  const isAbout = pathname === "/about";
  const isAuth = pathname === "/auth";

  const close = () => setOpen(false);

  const handleSignOut = () => {
    setStoredUser(null);
    close();
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isInicio ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/biblioteca" className={isBiblioteca ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isSalon ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAbout ? "active" : ""}>
            Acerca de
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={"av-mobile-backdrop" + (open ? " open" : "")} onClick={close} />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isInicio ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link href="/biblioteca" className={isBiblioteca ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon" className={isSalon ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAbout ? "active" : ""} onClick={close}>
          Acerca de
        </Link>
        {user ? (
          <a className={isAuth ? "active" : ""} onClick={handleSignOut}>
            Cerrar sesión
          </a>
        ) : (
          <Link href="/auth" className={isAuth ? "active" : ""} onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
