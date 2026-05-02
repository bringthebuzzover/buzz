/**
 * Fake Instagram profile for brand dashboard “Preview IG”: static stats, 3×2 grid from local
 * marketing assets, ui-avatars headshot. Renders nothing when `handle` is empty.
 */
import { X, CheckCircle, Heart } from "lucide-react";
import campus1 from "../../../assets/campus1.png";
import aboutBackground from "../../../assets/aboutBackground.png";
import contactBackground from "../../../assets/contactBackground.png";
import buzzLogo from "../../../assets/buzz-logo.png";
import instaIcon from "../../../assets/insta-icon.png";
import linkedinIcon from "../../../assets/linkedin-icon.png";

const MOCK_POST_IMAGES = [
  campus1,
  aboutBackground,
  contactBackground,
  buzzLogo,
  instaIcon,
  linkedinIcon,
];

type IGPreviewModalProps = {
  /** Instagram username without `@`; drives avatar URL and copy. */
  handle: string;
  /** Closes the overlay from the dismiss control. */
  onClose: () => void;
};

export default function IGPreviewModal({ handle, onClose }: IGPreviewModalProps) {
  if (!handle) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-butter bg-buzz-paper shadow-buzzLg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-buzz-line bg-buzz-cream p-1 text-buzz-inkFaint shadow-sm hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="border-b border-buzz-neutralHover bg-buzz-paper p-4">
          <div className="mb-4 flex items-center justify-center gap-1 text-center text-base font-bold text-buzz-ink">
            {handle}{" "}
            <CheckCircle
              size={14}
              className="fill-buzz-blue text-buzz-blue"
            />
          </div>

          <div className="mb-4 flex items-center justify-around">
            <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-buzz-spectrumStart via-buzz-spectrumMid to-buzz-spectrumEnd p-0.5">
              <div className="h-full w-full overflow-hidden rounded-full border-2 border-buzz-paper bg-buzz-paper">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    handle
                  )}&background=random`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-buzz-ink">124</div>
              <div className="text-xs font-medium text-buzz-inkMuted">posts</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-buzz-ink">2,451</div>
              <div className="text-xs font-medium text-buzz-inkMuted">followers</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-buzz-ink">450</div>
              <div className="text-xs font-medium text-buzz-inkMuted">following</div>
            </div>
          </div>

          <div className="mb-4 px-2">
            <div className="text-sm font-bold text-buzz-ink">{handle.toUpperCase()}</div>
            <div className="whitespace-pre-line text-sm font-medium text-buzz-inkMuted">
              Official chapter of {handle}
              {"\n"}
              📍 Campus Location{"\n"}
              Building leaders and making an impact.{"\n"}
              <span className="font-bold text-buzz-blueDark">linktr.ee/{handle}</span>
            </div>
          </div>

          <div className="flex gap-2 px-2">
            <button
              type="button"
              className="flex-1 rounded-lg bg-buzz-neutral py-1.5 text-sm font-bold text-buzz-darkDeep transition hover:bg-buzz-neutralHover"
            >
              Following
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-buzz-neutral py-1.5 text-sm font-bold text-buzz-darkDeep transition hover:bg-buzz-neutralHover"
            >
              Message
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0.5 bg-buzz-paper">
          {MOCK_POST_IMAGES.map((src, i) => (
            <div
              key={i}
              className="group relative aspect-square cursor-pointer bg-buzz-neutral"
            >
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              />
              <div className="absolute inset-0 flex items-center justify-center gap-4 bg-buzz-coral/40 text-sm font-bold text-buzz-paper opacity-0 transition group-hover:opacity-100">
                <span className="flex items-center gap-1">
                  <Heart size={16} className="fill-buzz-paper" /> 120
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
