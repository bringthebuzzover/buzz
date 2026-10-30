/**
 * Admin applicants "Shipping" cell: the seat's shipping status as a chip over
 * its city, and the shipments modal the chip opens (full address, tracking
 * numbers, delivered). On phones the modal is a bottom sheet.
 */
import { useState, type FormEvent } from "react";
import { ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import {
  useAddApplicantShipment,
  useDeleteApplicantShipment,
  useSetApplicantDelivered,
  type AdminApplicant,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import { Button, Checkbox, Select, TextField } from "../forms/controls";
import { Chip } from "../ui/Chip";
import { Modal, ModalActions } from "../ui/Modal";
import { ErrorNote } from "./AdminPrimitives";
import { formatDate, shipToCity } from "./labels";
import { carrierLabel } from "../../utils/shipments";
import { focusRingClass } from "../../theme/controls";
import { TEXT, type Tone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type Props = { dropId: string; applicant: AdminApplicant };

const iconButtonClass = cn(
  "rounded-full p-1 text-quiet hover:text-primary disabled:opacity-50",
  focusRingClass,
);
const headingClass = cn(TEXT.micro, "text-quiet");
// The Modal animation pins a centring transform, so the sheet turns it off.
const BOTTOM_SHEET = cn(
  "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none",
  "max-md:translate-x-0 max-md:translate-y-0 max-md:animate-none max-md:rounded-b-none max-md:p-6",
);
const ADDRESS_PENDING = <span className="text-xs font-medium text-buzz-warn">Address pending</span>;

function shippingStatus({ deliveredAt, shipments }: AdminApplicant): {
  label: string;
  tone: Tone;
} {
  if (deliveredAt != null) {
    return { label: `Delivered · ${formatDate(deliveredAt)}`, tone: "neutral" };
  }
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
        <ShipmentsModal dropId={dropId} applicant={applicant} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function ShipmentsModal({ dropId, applicant, onClose }: Props & { onClose: () => void }) {
  const add = useAddApplicantShipment(dropId, applicant.id);
  const remove = useDeleteApplicantShipment(dropId, applicant.id);
  const setDelivered = useSetApplicantDelivered(applicant.id);
  const [tn, setTn] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fail = (fallback: string) => (err: unknown) =>
    setError(err instanceof ApiError ? err.message : fallback);
  const units = applicant.allocatedUnits != null ? `${applicant.allocatedUnits} units` : null;

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const trackingNumber = tn.trim();
    if (!trackingNumber) return;
    const picked = carrier;
    // Clear first so a number typed while this one saves is never wiped.
    setError(null);
    setTn("");
    setCarrier("");
    try {
      await add.mutateAsync({ trackingNumber, carrier: picked || undefined });
    } catch (err) {
      setTn(trackingNumber);
      setCarrier(picked);
      fail("Could not add tracking.")(err);
    }
  }

  return (
    <Modal
      title={`Shipments · ${applicant.orgName}`}
      description={["Accepted", units].filter(Boolean).join(" · ")}
      className={BOTTOM_SHEET}
      onClose={onClose}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <section className="flex flex-col gap-1">
        <h3 className={headingClass}>Ship to</h3>
        {applicant.deliveryAddress ? (
          <p className={cn(TEXT.body, "text-primary")}>{applicant.deliveryAddress}</p>
        ) : (
          <>
            {ADDRESS_PENDING}
            <p className="text-xs text-quiet">
              The org hasn&apos;t added an address yet. You can still add tracking.
            </p>
          </>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className={headingClass}>Tracking</h3>
        {applicant.shipments.length === 0 ? (
          <p className={cn(TEXT.body, "text-quiet")}>No tracking yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-buzzField border border-line">
            {applicant.shipments.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-12 shrink-0 text-xs text-quiet">{carrierLabel(s.carrier)}</span>
                <span className="min-w-0 flex-1 break-all text-primary">#{s.trackingNumber}</span>
                {s.trackUrl ? (
                  <a
                    href={s.trackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Track #${s.trackingNumber}`}
                    className={iconButtonClass}
                  >
                    <ExternalLink size={16} aria-hidden />
                  </a>
                ) : null}
                <button
                  type="button"
                  data-testid={`remove-shipment-${s.id}`}
                  aria-label={`Remove #${s.trackingNumber}`}
                  className={iconButtonClass}
                  disabled={remove.isPending}
                  onClick={() => {
                    setError(null);
                    remove.mutateAsync(s.id).catch(fail("Could not remove tracking."));
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form className="flex items-end gap-2" onSubmit={(e) => void onAdd(e)}>
          <div className="min-w-0 flex-1">
            <TextField
              data-testid={`add-shipment-tn-${applicant.id}`}
              aria-label="Tracking number"
              placeholder="Tracking number"
              size="compact"
              value={tn}
              onChange={(e) => setTn(e.target.value)}
            />
          </div>
          <Select
            aria-label="Carrier"
            size="compact"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="">Auto</option>
            <option value="ups">UPS</option>
            <option value="fedex">FedEx</option>
            <option value="unknown">Unknown</option>
          </Select>
          <Button
            type="submit"
            variant="primary"
            size="compact"
            data-testid={`add-shipment-${applicant.id}`}
            disabled={!tn.trim()}
          >
            Add
          </Button>
        </form>
        <p className="text-xs text-quiet">
          Carrier is read from the number (1Z… = UPS, 12–22 digits = FedEx). Pick one only if it
          can&apos;t tell.
        </p>
      </section>
      <Checkbox
        data-testid={`delivered-${applicant.id}`}
        checked={applicant.deliveredAt != null}
        disabled={setDelivered.isPending}
        onChange={(e) => {
          setError(null);
          setDelivered.mutateAsync(e.target.checked).catch(fail("Could not save delivery."));
        }}
        label={
          <span className="flex flex-col">
            {applicant.deliveredAt != null
              ? `Delivered ${formatDate(applicant.deliveredAt)}`
              : "Mark delivered"}
            <span className="text-xs text-quiet">
              The org can also confirm it. Never blocks posting.
            </span>
          </span>
        }
      />
      <ModalActions onCancel={onClose} cancelLabel="Done" />
    </Modal>
  );
}
