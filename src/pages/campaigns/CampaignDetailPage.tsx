/**
 * Single-campaign marketing page: hero banner, logistics chips, long-form description, benefits list,
 * sticky apply sidebar, and optional `ApplyModal`.
 *
 * Reads `campaignId` from the URL; unknown ids redirect to `/campaigns`.
 * `applyOpen` toggles the application modal overlay.
 */
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Calendar, MapPin, ChevronLeft, CheckCircle } from "lucide-react";
import { getCampaignById } from "../../data/campaigns";
import ApplyModal from "../../components/site/modals/ApplyModal";

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [applyOpen, setApplyOpen] = useState(false);

  const campaign =
    campaignId != null ? getCampaignById(campaignId) : undefined;

  if (!campaign) {
    return <Navigate to="/campaigns" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <Link
        to="/campaigns"
        className="mb-6 flex items-center text-sm font-bold text-buzz-inkMuted transition hover:text-buzz-coral"
      >
        <ChevronLeft size={16} className="mr-1" />
        Back to Campaigns
      </Link>

      <div className="relative mb-8 flex h-80 items-end overflow-hidden rounded-2xl border-2 border-buzz-line bg-buzz-darkDeep text-buzz-paper shadow-md">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="relative z-10 w-full bg-gradient-to-t from-buzz-darkDeep via-buzz-overlay/60 to-transparent p-8">
          <span className="mb-3 inline-block rounded-full bg-buzz-coral px-3 py-1 text-xs font-bold text-buzz-paper shadow-sm">
            {campaign.brand}
          </span>
          <h1 className="text-4xl font-bold md:text-5xl">{campaign.title}</h1>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-6 border-b border-buzz-lineMid pb-6 text-sm text-buzz-inkMuted">
        <span className="flex items-center gap-2 rounded-lg bg-buzz-butter px-4 py-2 font-bold text-buzz-ink">
          <Calendar size={16} className="text-buzz-coral" />
          {campaign.date}
        </span>
        <span className="flex items-center gap-2 rounded-lg bg-buzz-butter px-4 py-2 font-bold text-buzz-ink">
          <MapPin size={16} className="text-buzz-coral" />
          {campaign.location}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <section>
            <h2 className="mb-4 text-2xl font-bold text-buzz-coral">
              About this Campaign
            </h2>
            <p className="rounded-xl border border-buzz-line bg-buzz-paper p-6 text-base font-medium leading-relaxed text-buzz-inkMuted shadow-sm">
              {campaign.description}
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold text-buzz-coral">
              What You&apos;ll Receive
            </h2>
            <ul className="list-none space-y-3 rounded-xl border border-buzz-line bg-buzz-paper p-6 font-medium text-buzz-inkMuted shadow-sm">
              <li className="flex items-start gap-3">
                <CheckCircle
                  size={20}
                  className="mt-0.5 shrink-0 text-buzz-coral"
                />
                Full PR packages for your group members
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle
                  size={20}
                  className="mt-0.5 shrink-0 text-buzz-coral"
                />
                Decor and promotional material for the pop-up
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle
                  size={20}
                  className="mt-0.5 shrink-0 text-buzz-coral"
                />
                Products to distribute to campus attendees
              </li>
            </ul>
          </section>
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl border border-buzz-lineMid bg-buzz-butter p-8 shadow-sm">
            <h3 className="mb-3 text-xl font-bold text-buzz-coral">
              Ready to host?
            </h3>
            <p className="mb-6 text-sm font-medium leading-relaxed text-buzz-inkMuted">
              Apply now to host this campaign. The brand will review your
              organization&apos;s profile and Instagram to select the perfect fit.
            </p>
            <button
              type="button"
              onClick={() => setApplyOpen(true)}
              className="w-full rounded-xl bg-buzz-coral py-4 text-lg font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>

      {applyOpen ? (
        <ApplyModal campaign={campaign} onClose={() => setApplyOpen(false)} />
      ) : null}
    </div>
  );
}
