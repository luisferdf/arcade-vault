import { getGames } from "@/lib/games";
import { HomeClient } from "./_components/HomeClient";

export default async function Home() {
  const games = await getGames();
  return <HomeClient games={games} />;
}
