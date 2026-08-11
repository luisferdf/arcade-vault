import { getGames } from "@/lib/games";
import { BibliotecaClient } from "../_components/BibliotecaClient";

export default async function Biblioteca() {
  const games = await getGames();
  return <BibliotecaClient games={games} />;
}
