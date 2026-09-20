import { headers } from "next/headers";
import HomeScreen from "@/components/home/HomeScreen";

export default function Home() {
  const anonId = headers().get("x-anon-id");
  return <HomeScreen anonId={anonId} />;
}
