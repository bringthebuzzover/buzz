/**
 * Admin applicants "Shipping" cell: the seat's shipping status as a chip over
 * its city, and the shipments modal the chip opens (full address, tracking
 * numbers, delivered). On phones the modal is a bottom sheet.
 */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  useAddApplicantShipment,
  useDeleteApplicantShipment,
  useSetApplicantDelivered,
  type AdminApplicant,
} from "../../api/hooks/useAdminHooks";
import { Chip } from "../ui/Chip";
import { ShipmentsModal } from "../shipments/ShipmentsModal";
import { formatDate, shipToCity } from "./labels";
import { focusRingClass } from "../../theme/controls";
import type { Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type Props = { dropId: string; applicant: AdminApplicant };

const ADDRESS_PENDING = <span className="text-xs font-medium text-buzz-warn">Address pending</span>;

function shippingStatus({ deliveredAt, shipments }: AdminApplicant): { label: string; tone: Tone } {
  if (deliveredAt != null) return { label: `Delivered · ${formatDate(deliveredAt)}`, tone: "neutral" };
  const n = shipments.length;
  if (n === 0) return { label: "Not shipped", tone: "warn" };
  return { label: `Shipped · ${n} ${n === 1 ? "package" : "packages"}`, tone: "pending" };
}

/** City, state (or Address pending); the chip and modal only on a live seat. */
export function ApplicantShipping({ dropId, applicant, live }: Props & { live: boolean }) {
  const [open, setOpen] = useState(false);
  const city = shipToCity(applicant.shippingCity, applicant.shippingState);
  const place = city ? <span className="text-xs text-quiet">{city}</span> : ADDRESS_PENDING;
  if (!live) return place;
  const status = shippingStatus(applicant);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid={`shipping-${applicant.id}`}
        aria-haspopup="dialog"
        aria-label={`${status.label} – shipments for ${applicant.orgName}`}
        className={cn("max-w-full rounded-full text-left", focusRingClass)}
        onClick={() => setOpen(true)}
      >
        <Chip tone={status.tone} dot className="max-md:whitespace-normal">
          {status.label}
          <ChevronRight size={12} aria-hidden />
        </Chip>
      </button>
      {place}
      {open && (
        <AdminShipmentsModal dropId={dropId} applicant={applicant} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function AdminShipmentsModal({ dropId, applicant, onClose }: Props & { onClose: () => void }) {
  const add = useAddApplicantShipment(dropId, applicant.id);
  const remove = useDeleteApplicantShipment(dropId, applicant.id);
  const setDelivered = useSetApplicantDelivered(applicant.id);
  return (
    <ShipmentsModal
      applicant={applicant}
      add={add}
      remove={remove}
      setDelivered={setDelivered}
      onClose={onClose}
    />
  );
}
