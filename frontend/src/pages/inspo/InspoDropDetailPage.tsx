/**
 * Campaign detail overlay — hero, brief, about rail, apply CTA.
 */
import { Link } from "react-router-dom";
import ztaLacroix from "../../assets/zta-lacroix.png";
import { LinkButton } from "../../components/forms/controls";
import { Chip } from "../../components/ui/Chip";
import { siteIdentity } from "../../data/siteIdentity";
import { GAP, PAD, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const TAGS = ["Campus drop", "Product sampling", "Instagram"] as const;
const META = ["Remote", "9 days", "1–5 hrs/week", "Sep 13–22"] as const;

export default function InspoDropDetailPage() {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 py-10 md:px-10")}>
      <p className={cn(TEXT.meta, "mb-4")}>
        <Link to="/inspo" className="hover:text-buzz-coral">
          ← Back to Buzz
        </Link>
      </p>
      <div
        className={cn(
          SURFACE.modal,
          "grid md:grid-cols-[1.4fr_0.9fr]",
          PAD.roomy,
          GAP.section,
        )}
      >
        <div>
          <div className="relative mb-6 overflow-hidden rounded-buzzCard">
            <img
              src={ztaLacroix}
              alt=""
              className="h-56 w-full object-cover md:h-64"
            />
            <span className="absolute right-4 top-4 rounded-full bg-buzz-paper px-4 py-1.5 text-sm font-semibold text-buzz-ink">
              Follow
            </span>
            <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-buzz-coral text-lg font-semibold text-buzz-paper shadow-buzz">
              {siteIdentity.brand.name}
            </span>
          </div>
          <h1 className={TEXT.h2}>Campus drop — La Croix sampling kit</h1>
          <p className={cn(TEXT.body, "mt-1 text-buzz-inkMuted")}>
            Zeta Tau Alpha × Buzz
          </p>
          <div className={cn("mt-4 flex flex-wrap", GAP.tight)}>
            {TAGS.map((tag) => (
              <Chip key={tag} className="normal-case tracking-normal">
                {tag}
              </Chip>
            ))}
          </div>
          <div className={cn("mt-3 flex flex-wrap", GAP.tight)}>
            <Chip tone="neutral" className="normal-case tracking-normal">
              Product + merch
            </Chip>
            {META.map((item) => (
              <Chip key={item} tone="neutral" className="normal-case tracking-normal">
                {item}
              </Chip>
            ))}
          </div>
          <p className={cn(TEXT.bodyLong, "mt-6")}>
            Buzz is inviting your org to sample and share La Croix on campus.
            Purchase the kit, host a tasting, and post from the organization
            Instagram while the drop is open.
          </p>
          <p className={cn(TEXT.body, "mt-3 leading-relaxed text-buzz-inkMuted")}>
            You are responsible for buying the kit, using the product, and
            posting a review once it arrives.
          </p>
          <h2 className={cn(TEXT.h3, "mt-8")}>Expected outputs</h2>
          <ul className={cn(TEXT.body, "mt-3 list-disc space-y-2 pl-5 text-buzz-inkMuted")}>
            <li>Search the product on campus retail or the brand store</li>
            <li>Host a tasting with members and capture the moment</li>
            <li>Leave an honest review from the org Instagram</li>
          </ul>
        </div>
        <aside className={cn("flex flex-col", GAP.default)}>
          <div className={cn(SURFACE.cardFlat, PAD.card)}>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-buzz-coral text-xs font-semibold text-buzz-paper">
              ZTA
            </div>
            <h2 className={TEXT.h3}>About this drop</h2>
            <p className={cn(TEXT.body, "mt-2 leading-relaxed text-buzz-inkMuted")}>
              Sparkling water sampling for Greek orgs. Hypoallergenic merch,
              campus-ready kits, and a short posting window.
            </p>
          </div>
          <div className="rounded-full bg-buzz-neutral py-3 text-center text-sm font-semibold text-buzz-inkMuted">
            {siteIdentity.brand.name}
          </div>
          <div className="rounded-buzzCard bg-gradient-to-br from-buzz-coral to-buzz-coralDark p-6 text-buzz-paper">
            <p className={TEXT.h2}>Org card</p>
            <p className={cn(TEXT.meta, "mt-8 text-right text-buzz-paper/80")}>
              Buzz
            </p>
          </div>
          <LinkButton to="/login" variant="outline" fullWidth>
            Log in to see tailored campaigns →
          </LinkButton>
          <LinkButton to="/org/apply" fullWidth>
            Apply with my org
          </LinkButton>
        </aside>
      </div>
    </div>
  );
}
