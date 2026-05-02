/**
 * Brand-facing hub: CTA row (strategy call + post campaign), tabbed panel with applicant table or stat cards,
 * and stacked modals for phone callback request and Instagram preview.
 *
 * `activeTab` switches campaigns vs stats mockups; `strategyOpen` / `previewHandle` control which modal is visible.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  PhoneCall,
  Plus,
  Activity,
  CheckCircle,
  Camera,
  Heart,
  Eye,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { MOCK_APPLICANTS } from "../../data/mockApplicants";
import StrategyCallModal from "../../components/site/modals/StrategyCallModal";
import IGPreviewModal from "../../components/site/modals/IGPreviewModal";

export default function BrandDashboardPage() {
  const [activeTab, setActiveTab] = useState<"campaigns" | "stats">(
    "campaigns"
  );
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [previewHandle, setPreviewHandle] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-buzz-ink">Brand Portal</h1>
          <p className="font-medium text-buzz-inkMuted">
            Manage your campus campaigns and review applicants.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStrategyOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-2 font-bold text-buzz-inkMuted shadow-sm transition hover:bg-buzz-butter hover:text-buzz-coral"
          >
            <PhoneCall size={16} /> Book Strategy Call
          </button>
          <Link
            to="/brand/campaigns/new"
            className="flex items-center gap-2 rounded-lg bg-buzz-coral px-4 py-2 font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
          >
            <Plus size={16} /> Post Campaign
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
        <div className="flex gap-8 border-b border-buzz-line bg-buzz-cream px-8">
          <button
            type="button"
            className={`border-b-2 py-4 font-bold ${
              activeTab === "campaigns"
                ? "border-buzz-coral text-buzz-coral"
                : "border-transparent text-buzz-inkMuted hover:text-buzz-ink"
            }`}
            onClick={() => setActiveTab("campaigns")}
          >
            Active Campaigns
          </button>
          <button
            type="button"
            className={`border-b-2 py-4 font-bold ${
              activeTab === "stats"
                ? "border-buzz-coral text-buzz-coral"
                : "border-transparent text-buzz-inkMuted hover:text-buzz-ink"
            }`}
            onClick={() => setActiveTab("stats")}
          >
            Stats & Performance
          </button>
        </div>

        {activeTab === "campaigns" ? (
          <div className="p-8">
            <h3 className="mb-6 text-xl font-bold text-buzz-coral">
              Your Campaign: Poppi New Flavor Launch
            </h3>

            <div className="overflow-x-auto rounded-xl border border-buzz-line">
              <table className="w-full border-collapse bg-buzz-paper text-left">
                <thead className="bg-buzz-cream">
                  <tr className="border-b border-buzz-line text-sm text-buzz-inkMuted">
                    <th className="p-4 font-bold">Organization</th>
                    <th className="p-4 font-bold">Instagram Handle</th>
                    <th className="p-4 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_APPLICANTS.map(app => (
                    <tr
                      key={app.id}
                      className="border-b border-buzz-line transition hover:bg-buzz-cream"
                    >
                      <td className="p-4 font-bold text-buzz-ink">{app.org}</td>
                      <td className="p-4 font-medium text-buzz-coral">
                        @{app.handle}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setPreviewHandle(app.handle)}
                          className="flex items-center gap-1 rounded-lg border border-buzz-lineMid bg-buzz-butter px-3 py-1.5 text-sm font-bold text-buzz-ink shadow-sm transition hover:bg-buzz-butterBright"
                        >
                          <ExternalLink size={14} className="text-buzz-coral" />{" "}
                          Preview IG
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <h3 className="mb-6 text-xl font-bold text-buzz-coral">
              Campaign Performance Overview
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Activity, value: "3", label: "Campaigns in Progress" },
                { icon: CheckCircle, value: "12", label: "Campaigns Finished" },
                { icon: Camera, value: "348", label: "Total Posts Submitted" },
                { icon: Heart, value: "45.2K", label: "Total Engagements" },
                { icon: Eye, value: "1.2M", label: "Estimated Reach" },
                {
                  icon: DollarSign,
                  value: "$0.14",
                  label: "Cost Per Engagement",
                },
              ].map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center rounded-2xl border border-buzz-lineMid bg-buzz-cream p-8 text-center shadow-sm"
                >
                  <div className="mb-4 rounded-full bg-buzz-butter p-4">
                    <Icon size={32} className="text-buzz-coral" />
                  </div>
                  <div className="mb-2 text-4xl font-black text-buzz-ink">
                    {value}
                  </div>
                  <div className="text-sm font-bold uppercase tracking-wider text-buzz-inkMuted">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {strategyOpen ? (
        <StrategyCallModal onClose={() => setStrategyOpen(false)} />
      ) : null}
      {previewHandle ? (
        <IGPreviewModal
          handle={previewHandle}
          onClose={() => setPreviewHandle(null)}
        />
      ) : null}
    </div>
  );
}
