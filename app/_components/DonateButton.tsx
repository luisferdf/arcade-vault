import { DONATE_URL } from "@/lib/donate";

type Props = {
  variant?: "button" | "link";
  className?: string;
};

export function DonateButton({ variant = "button", className }: Props) {
  if (!DONATE_URL) return null;

  const base = variant === "link" ? "donate-link" : "btn yellow";

  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `${base} ${className}` : base}
    >
      ☕ INVÍTAME UN CAFÉ
    </a>
  );
}
