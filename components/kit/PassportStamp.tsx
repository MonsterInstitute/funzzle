"use client";

import { useEffect } from "react";
import { stampPassport } from "@/lib/games/kit/passport";

/** Stamps the game passport when a game screen opens (for games without game_start tracking). */
export default function PassportStamp({ game }: { game: string }) {
  useEffect(() => stampPassport(game), [game]);
  return null;
}
