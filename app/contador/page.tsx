"use client";

import { useState } from "react";

const MAX_POKEMON = 1025;
const SPRITE_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

export default function ContadorPage() {
  const [count, setCount] = useState(1);
  const id = ((count - 1) % MAX_POKEMON) + 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-[#00f5ff]">Contador Pokémon</h1>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={id}
        src={`${SPRITE_URL}/${id}.png`}
        alt={`Pokémon #${id}`}
        width={256}
        height={256}
        className="h-64 w-64 object-contain"
      />
      <p className="text-5xl font-bold text-[#f5ff00]">{count}</p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="rounded-lg border-2 border-[#ff006e] px-8 py-3 text-xl font-bold text-[#ff006e] transition hover:bg-[#ff006e] hover:text-black"
      >
        +1
      </button>
    </main>
  );
}
