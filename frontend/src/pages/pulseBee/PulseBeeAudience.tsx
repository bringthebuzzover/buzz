/**
 * Pieces shared by /pulse-bee/orgs and /pulse-bee/brands. Same tokens and
 * classes as /pulse-bee; the new ones are `.pulsebee-aud-*`.
 * Copy here must come from text already in the repo (pulse-bee, /for-orgs,
 * /for-brands, PRODUCT.md). Do not add numbers, prices, or timelines.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { publicLogo } from "../../utils/publicLogo";
import "./pulseBeeAudience.css";

export const BEE = publicLogo("bee.svg");

export type NumberedCard = {
  title: string;
  body: string;
  /** Photo from /pulse-bee. Omit for the yellow bee tile. */
  image?: string;
};

export function NumberedCards({ cards }: { cards: readonly NumberedCard[] }) {
  return (
    <ol className="pulsebee-aud-cards">
      {cards.map((card, i) => (
        <li key={card.title} className="pulsebee-aud-card">
          <div
            className={
              card.image
                ? "pulsebee-aud-card__media"
                : "pulsebee-aud-card__media pulsebee-aud-card__media--mark"
            }
          >
            <img src={card.image ?? BEE} alt="" />
            <span className="pulsebee-aud-card__n" aria-hidden="true">
              {i + 1}
            </span>
          </div>
          <h3>{card.title}</h3>
          <p>{card.body}</p>
        </li>
      ))}
    </ol>
  );
}

export type FaqItem = { q: string; a: ReactNode };

export function Faq({ id, items }: { id: string; items: readonly FaqItem[] }) {
  return (
    <section className="pulse2-band" id={id} data-theme="paper" aria-labelledby={`${id}-title`}>
      <div className="pulsebee-aud-faq">
        <h2 id={`${id}-title`} className="pulsebee-aud-faq__title">
          Questions
        </h2>
        <ul className="pulsebee-aud-faq__list">
          {items.map((item) => (
            <li key={item.q}>
              <details className="pulsebee-aud-faq__item">
                <summary>
                  <span>{item.q}</span>
                  <span className="pulsebee-aud-faq__icon" aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export type JoinHalf = {
  id: string;
  kicker: string;
  title: ReactNode;
  support: string;
  pill: string;
  to: string;
  quiet?: { label: string; to: string };
};

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6 3 L11 8 L6 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The two-up join block from /pulse-bee. */
export function JoinBlock({ halves }: { halves: readonly [JoinHalf, JoinHalf] }) {
  return (
    <section className="pulse2-join" data-theme="paper" aria-label="Join">
      {halves.map((half) => (
        <div key={half.id} className="pulse2-join__half" id={half.id}>
          <Link className="pulse2-join__main" to={half.to}>
            <span className="pulse2-join__kicker">{half.kicker}</span>
            <span className="pulse2-join__title">{half.title}</span>
            <span className="pulse2-join__support">{half.support}</span>
            <span className="pulse2-join__pill">
              {half.pill}
              <ChevronRight />
            </span>
          </Link>
          {half.quiet ? (
            <Link className="pulse2-join__quiet" to={half.quiet.to}>
              {half.quiet.label}
            </Link>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/** Photo hero in the /pulse-bee layout: copy bottom-left, aside bottom-right. */
export function AudienceHero({
  image,
  lines,
  sub,
  actions,
  aside,
}: {
  image: string;
  lines: readonly string[];
  sub: string;
  actions: ReactNode;
  aside: { kicker: string; text: string };
}) {
  return (
    <section className="pulse2-hero" data-theme="ink" data-surface="dark" aria-label="Introduction">
      <img className="pulsebee-aud-hero__media" src={image} alt="" />
      <div className="pulse2-hero__scrim" aria-hidden="true" />
      <div className="pulse2-hero__shade" aria-hidden="true" />
      <img className="pulse2-bee" src={BEE} alt="" />
      <div className="pulse2-hero__copy">
        <h1 className="pulse2-display">
          {lines.map((line) => (
            <span key={line} className="pulse2-line" data-reveal="load">
              <span>{line}</span>
            </span>
          ))}
        </h1>
        <p className="pulse2-hero__sub pulse2-line" data-reveal="load">
          <span>{sub}</span>
        </p>
        <div className="pulse2-hero__actions">{actions}</div>
      </div>
      <aside className="pulse2-hero__aside">
        <p className="pulse2-kicker">{aside.kicker}</p>
        <p>{aside.text}</p>
      </aside>
    </section>
  );
}

/** Centered statement band, first line ink and second line quiet. */
export function Statement({ id, lead, quiet }: { id: string; lead: string; quiet: string }) {
  return (
    <section className="pulse2-band" data-theme="paper" aria-labelledby={id}>
      <div className="pulse2-measure" data-reveal-group>
        <h2 id={id} className="pulse2-statement">
          <span className="pulse2-line">
            <span>{lead}</span>
          </span>
          <span className="pulse2-line pulse2-line--quiet">
            <span>{quiet}</span>
          </span>
        </h2>
      </div>
    </section>
  );
}
