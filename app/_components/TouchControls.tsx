"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TouchAction } from "@/lib/games/engine";

interface TouchControlsProps {
  onInput: (action: TouchAction, pressed: boolean) => void;
}

/**
 * Triángulo dibujado en CSS puro (borde), no glifo Unicode: `▲/▼/◀/▶` no
 * comparten el mismo tamaño ni peso visual en la fuente pixel del proyecto.
 */
function DpadArrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  return <span className={`dpad-arrow dpad-arrow-${dir}`} />;
}

export function TouchControls({ onInput }: TouchControlsProps) {
  // Red de seguridad: si el navegador se pierde un touchend/touchcancel (dedo
  // sale del viewport, notificación del sistema), no debe quedar un botón
  // "trabado" en pressed:true al perder el foco de la ventana.
  const releaseAllRef = useRef<() => void>(() => {});
  const releasers = useRef(new Set<() => void>());
  releaseAllRef.current = () => {
    releasers.current.forEach((release) => release());
  };

  useEffect(() => {
    const releaseAll = () => releaseAllRef.current();
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", releaseAll);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseAll);
    };
  }, []);

  const registerReleaser = (release: () => void) => {
    releasers.current.add(release);
    return () => releasers.current.delete(release);
  };

  return (
    <div
      className="touch-controls"
      role="group"
      aria-label="Controles táctiles"
    >
      <div className="touch-dpad">
        <div />
        <TouchButton
          action="up"
          label={<DpadArrow dir="up" />}
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="dpad-up"
        />
        <div />
        <TouchButton
          action="left"
          label={<DpadArrow dir="left" />}
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="dpad-left"
        />
        <div />
        <TouchButton
          action="right"
          label={<DpadArrow dir="right" />}
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="dpad-right"
        />
        <div />
        <TouchButton
          action="down"
          label={<DpadArrow dir="down" />}
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="dpad-down"
        />
        <div />
      </div>
      <div className="touch-buttons">
        <TouchButton
          action="b"
          label="B"
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="action-b"
        />
        <TouchButton
          action="a"
          label="A"
          onInput={onInput}
          registerReleaser={registerReleaser}
          className="action-a"
        />
      </div>
    </div>
  );
}

interface TouchButtonProps {
  action: TouchAction;
  label: ReactNode;
  className: string;
  onInput: (action: TouchAction, pressed: boolean) => void;
  registerReleaser: (release: () => void) => () => void;
}

function TouchButton({
  action,
  label,
  className,
  onInput,
  registerReleaser,
}: TouchButtonProps) {
  const [pressed, setPressed] = useState(false);
  // Ids de los dedos activos sobre este botón, para que soltar uno no
  // cancele el estado "pressed" mientras otro siga tocando el mismo botón.
  const activeIds = useRef(new Set<number>());
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const release = () => {
      if (activeIds.current.size === 0) return;
      activeIds.current.clear();
      setPressed(false);
      onInput(action, false);
    };
    return registerReleaser(release);
  }, [action, onInput, registerReleaser]);

  // React registra los listeners de `onTouchStart`/`onTouchMove` como pasivos
  // en el root (igual que hace el navegador por defecto, para no bloquear el
  // scroll): `preventDefault()` dentro de un handler sintético no surte
  // efecto ahí y el navegador avisa por consola. Los registramos a mano con
  // `{ passive: false }` para poder bloquear el scroll/zoom al arrastrar
  // sobre el D-pad.
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;

    const handleStart = (e: TouchEvent) => {
      e.preventDefault();
      const wasEmpty = activeIds.current.size === 0;
      for (const touch of Array.from(e.changedTouches)) {
        activeIds.current.add(touch.identifier);
      }
      if (wasEmpty) {
        setPressed(true);
        onInput(action, true);
      }
    };

    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        activeIds.current.delete(touch.identifier);
      }
      if (activeIds.current.size === 0) {
        setPressed(false);
        onInput(action, false);
      }
    };

    el.addEventListener("touchstart", handleStart, { passive: false });
    el.addEventListener("touchend", handleEnd, { passive: false });
    el.addEventListener("touchcancel", handleEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleStart);
      el.removeEventListener("touchend", handleEnd);
      el.removeEventListener("touchcancel", handleEnd);
    };
  }, [action, onInput]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`touch-btn ${className}${pressed ? " pressed" : ""}`}
      aria-label={action}
    >
      {label}
    </button>
  );
}
