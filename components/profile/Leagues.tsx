"use client";

import { useEffect, useState } from "react";
import { GAME_BY_SLUG } from "@/lib/games/kit/catalog";
import { getDisplayName, NAME_MAX } from "@/lib/games/kit/identity";
import { createLeague, fetchBoard, inviteLink, joinLeague, leaveLeague, myLeagues, type LeagueBoard, type MyLeague } from "@/lib/games/kit/leagues";
import { snapshot, useLocal } from "@/lib/games/kit/useLocal";

const readMine = snapshot(() => myLeagues());
const INPUT = "min-h-11 min-w-0 flex-[1_1_180px] rounded-xl border border-line-strong bg-ground px-3 text-base text-ink";
const BUTTON = "min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-ground disabled:opacity-60";

function Board({ code }: { code: string }) {
  const [board, setBoard] = useState<LeagueBoard | null>(null);
  const [tab, setTab] = useState("overall");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetchBoard(code)
      .then(setBoard)
      .catch((e) => setError((e as Error).message));
  }, [code]);
  if (error) return <p className="m-0 text-sm text-card-red">{error}</p>;
  if (!board) return <p className="m-0 text-sm text-muted">Loading the board…</p>;
  const tabs = ["overall", ...Object.keys(board.boards).filter((k) => k !== "overall")];
  const rows = board.boards[tab] ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          Week of {new Date(`${board.week}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} · {board.members.length} member
          {board.members.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="min-h-10 rounded-full border border-line-strong px-4 text-sm font-semibold"
          onClick={async () => {
            const url = inviteLink(code);
            try {
              if (navigator.share) await navigator.share({ title: `Join ${board.name} on Funzzle`, text: `Join my puzzle league "${board.name}" (code ${code})`, url });
              else await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              window.prompt("Invite link", url);
            }
          }}
        >
          {copied ? "Invite ready" : `Invite · ${code}`}
        </button>
      </div>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            type="button"
            onClick={() => setTab(t)}
            className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${tab === t ? "bg-ink text-ground" : "bg-soft text-ink"}`}
          >
            {t === "overall" ? "Overall" : (GAME_BY_SLUG[t]?.name ?? t)}
          </button>
        ))}
      </div>
      {rows.length ? (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((r, i) => (
            <li key={r.name} className="flex items-center justify-between rounded-2xl bg-soft px-3.5 py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="w-5 font-mono text-sm text-muted-2">{i + 1}</span>
                <span className="font-semibold">{r.name}</span>
              </span>
              <span className="font-mono text-sm">
                {r.points} pt{r.points === 1 ? "" : "s"}
                <span className="ml-2 text-muted-2">{r.played} played</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-sm text-muted">No daily puzzles finished this week yet.</p>
      )}
      <button
        type="button"
        className="self-start text-sm text-muted underline"
        onClick={async () => {
          if (!confirm(`Leave ${board.name}?`)) return;
          await leaveLeague(code).catch(() => {});
          location.reload();
        }}
      >
        Leave league
      </button>
    </div>
  );
}

/** /leagues: your leagues with weekly boards, plus create and join forms. */
export default function Leagues() {
  const mine = useLocal(readMine, [] as MyLeague[]);
  const [name, setName] = useState("");
  const [me, setMe] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const join = new URLSearchParams(location.search).get("join");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill from this device and the invite link, once
    setMe(getDisplayName());
    if (join && /^[A-Za-z2-9]{6}$/.test(join)) setCode(join.toUpperCase());
  }, []);

  async function run(fn: () => Promise<MyLeague>) {
    if (!me.trim()) return setMessage("Add the name your league will see.");
    setBusy(true);
    setMessage(null);
    try {
      const l = await fn();
      setMessage(`You’re in ${l.name}. Code: ${l.code}`);
      history.replaceState(null, "", location.pathname);
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {mine.map((l) => (
        <section key={l.code} className="flex flex-col gap-3 rounded-[26px] border border-line p-5">
          <h2 className="m-0 font-display text-[26px] font-extrabold tracking-[-0.02em]">{l.name}</h2>
          <Board code={l.code} />
        </section>
      ))}

      <section className="flex flex-col gap-4 rounded-[26px] bg-soft p-5">
        <h2 className="m-0 text-xl font-bold">{mine.length ? "Join or start another league" : "Join or start a league"}</h2>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Your name in the league
          <input value={me} maxLength={NAME_MAX} onChange={(e) => setMe(e.target.value)} placeholder="e.g. Sam" className={INPUT} />
        </label>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => joinLeague(code, me));
          }}
        >
          <label className="flex flex-[1_1_180px] flex-col gap-1.5 text-sm font-semibold">
            Invite code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC234"
              autoCapitalize="characters"
              className={`${INPUT} font-mono tracking-[0.2em]`}
            />
          </label>
          <button type="submit" disabled={busy || code.length !== 6} className={BUTTON}>
            Join
          </button>
        </form>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setMessage("Give your league a name.");
            run(() => createLeague(name, me));
          }}
        >
          <label className="flex flex-[1_1_180px] flex-col gap-1.5 text-sm font-semibold">
            New league name
            <input value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="The Garcias, Room 12, Design team…" className={INPUT} />
          </label>
          <button type="submit" disabled={busy} className={BUTTON}>
            Create
          </button>
        </form>
        {message && (
          <p role="status" className="m-0 text-sm">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
