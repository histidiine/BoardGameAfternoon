import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameBySlug, getMembers, getMyFavorites, getViewer, getVoteContext } from "@/lib/data";
import { COMPLEXITY_LABEL, LANG_LABEL, duration, fmtDay, isAvailable, plural, playersLong } from "@/lib/domain";
import { starProps } from "@/lib/votes";
import { Avatar, Cover, Tag } from "@/components/Bits";
import { Icon } from "@/components/Icons";
import { HeartButton, StarButton } from "@/components/VoteButtons";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const game = await getGameBySlug((await params).slug);
  return { title: game?.name ?? "Game not found" };
}

export default async function GamePage({ params }: Params) {
  const game = await getGameBySlug((await params).slug);
  if (!game) notFound();
  const [viewer, favorites, vote, members] = await Promise.all([getViewer(), getMyFavorites(), getVoteContext(), getMembers()]);
  const names = new Map(members.map((m) => [m.id, m]));
  const e = vote.encounter;
  const mine = !!viewer && game.copies.some((c) => c.owner.id === viewer.id);
  const t = vote.tally[game.id];
  const langs = [...new Set(game.copies.map((c) => c.language).filter((l) => l !== null))].map((l) => LANG_LABEL[l]).join(", ") || "Not set";
  const bgg = game.bgg_id
    ? `https://boardgamegeek.com/boardgame/${game.bgg_id}`
    : `https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(game.name)}`;
  const video = game.rules_video_url || `https://www.youtube.com/results?search_query=${encodeURIComponent(game.name + " board game rules")}`;

  return (
    <div className="page-pad">
      <Link className="back" href="/">
        <Icon name="back" />
        The shelf
      </Link>
      <article className="surface detail" style={{ marginTop: 12 }}>
        <Cover game={game} size="big" />
        <div className="dbody">
          <div className="tags">
            {game.types.map((ty) => (
              <Tag key={ty} type={ty} />
            ))}
          </div>
          <h1 style={{ fontSize: 28 }}>{game.name}</h1>
          {game.description && <p>{game.description}</p>}
          {game.copies.length > 0 && !isAvailable(game) && (
            <p className="unavail">Not available right now: {game.copies.length === 1 ? "its owner cannot" : "none of its owners can"} bring it for the moment.</p>
          )}
          {game.copies.length ? (
            <div className="dacts">
              <HeartButton gameId={game.id} gameName={game.name} on={favorites.includes(game.id)} loggedIn={!!viewer} big />
              <StarButton {...starProps(game, vote, !!viewer)} big />
            </div>
          ) : (
            <p className="hint">This game is no longer on anyone{"’"}s shelf. It stays here for past vote pages.</p>
          )}
          {viewer && e && (
            <p className="hint">
              {Math.max(0, vote.budget - vote.used)} of {vote.budget} stars left for {fmtDay(e.starts_at)}.
            </p>
          )}
          <dl className="stats">
            <div>
              <dt><Icon name="meeple" />Players</dt>
              <dd>{playersLong(game)}</dd>
            </div>
            <div>
              <dt><Icon name="hourglass" />Duration</dt>
              <dd>about {duration(game.duration_min)}</dd>
            </div>
            <div>
              <dt><Icon name="die" />Complexity</dt>
              <dd>{game.complexity ? COMPLEXITY_LABEL[game.complexity] : "Not set"}</dd>
            </div>
            <div>
              <dt>Age</dt>
              <dd>{game.min_age ? `${game.min_age}+` : "Not set"}</dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{langs}</dd>
            </div>
          </dl>
          {game.copies.length > 0 && (
            <div>
              <h3>On the shelf of</h3>
              <ul className="plist" style={{ marginTop: 8 }}>
                {game.copies.map((c) => (
                  <li key={c.owner.id}>
                    <Avatar member={c.owner} large />
                    <div>
                      <b>{c.owner.display_name}</b>
                      <div className="hint">
                        {!c.available && <b style={{ color: "var(--card-heart)" }}>Not available right now · </b>}
                        {c.language ? LANG_LABEL[c.language] : "Language not set"}
                        {c.notes ? ` · ${c.notes}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {mine && (
                <p style={{ marginTop: 10 }}>
                  <Link className="btn ghost" href={`/profile?edit=${encodeURIComponent(game.slug)}#game-${game.slug}`} style={{ padding: "6px 12px", fontSize: 14 }}>
                    Edit my copy
                  </Link>
                </p>
              )}
            </div>
          )}
          {e && (
            <div>
              <h3>Stars for {fmtDay(e.starts_at)}</h3>
              <div className="voters" style={{ marginTop: 8 }}>
                {!t ? (
                  <span className="hint">No stars yet. Be the first.</span>
                ) : vote.anonymous && t.voterStars.reduce((s, n) => s + n, 0) < t.votes ? (
                  <span className="hint">{plural(t.votes, "star")} (names hidden)</span>
                ) : (
                  t.voterIds.map((id, i) => (
                    <span className="vchip" key={id}>
                      <Avatar member={names.get(id)} />
                      {names.get(id)?.display_name ?? "Former member"}
                      {t.voterStars[i] > 1 && <b> ×{t.voterStars[i]}</b>}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
          <div className="links">
            <a className="btn ghost" href={bgg} target="_blank" rel="noopener noreferrer">
              <Icon name="link" /> BoardGameGeek page
            </a>
            <a className="btn ghost" href={video} target="_blank" rel="noopener noreferrer">
              <Icon name="link" /> Rules video
            </a>
          </div>
        </div>
      </article>
    </div>
  );
}
