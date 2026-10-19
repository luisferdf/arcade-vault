// URL pública de donación (Ko-fi). Sin variable → ninguna superficie de donación se renderiza.
export const DONATE_URL: string | null =
  process.env.NEXT_PUBLIC_DONATE_URL || null;
