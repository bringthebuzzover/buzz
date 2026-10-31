import { useState, type FormEvent } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { ApiError } from "../../api/client";
import { Button, Checkbox, Select, TextField } from "../forms/controls";
import { Modal, ModalActions } from "../ui/Modal";
import { ErrorNote } from "../admin/AdminPrimitives";
import { formatDate } from "../admin/labels";
import { carrierLabel, type Shipment } from "../../utils/shipments";
import { focusRingClass } from "../../theme/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type TrackingInput = { trackingNumber: string; carrier?: string };
type Mutation<T> = {
  mutateAsync: (input: T) => Promise<unknown>;
  isPending: boolean;
};
type Props = {
  applicant: {
    id: string;
    orgName: string;
    allocatedUnits?: number | null;
    deliveryAddress?: string | null;
    shipments: Shipment[];
    deliveredAt?: number | null;
  };
  add: Mutation<TrackingInput>;
  remove: Mutation<string>;
  update?: Mutation<TrackingInput & { shipmentId: string }>;
  setDelivered?: Mutation<boolean>;
  onClose: () => void;
};

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
const ADDRESS_PENDING = (
  <span className="text-xs font-medium text-buzz-warn">Address pending</span>
);

export function ShipmentsModal({
  applicant,
  add,
  remove,
  update,
  setDelivered,
  onClose,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tn, setTn] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fail = (fallback: string) => (err: unknown) =>
    setError(err instanceof ApiError ? err.message : fallback);

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
      if (editingId && update) {
        await update.mutateAsync({
          shipmentId: editingId,
          trackingNumber,
          carrier: picked || undefined,
        });
        setEditingId(null);
      } else {
        await add.mutateAsync({ trackingNumber, carrier: picked || undefined });
      }
    } catch (err) {
      setTn(trackingNumber);
      setCarrier(picked);
      fail(editingId ? "Could not save tracking." : "Could not add tracking.")(
        err,
      );
    }
  }

  return (
    <Modal
      title={`Shipments · ${applicant.orgName}`}
      description={
        applicant.allocatedUnits != null
          ? `Accepted · ${applicant.allocatedUnits} units`
          : "Accepted"
      }
      className={BOTTOM_SHEET}
      onClose={onClose}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <section className="flex flex-col gap-1">
        <h3 className={headingClass}>Ship to</h3>
        <p className={cn(TEXT.body, "text-primary")}>
          {applicant.deliveryAddress || ADDRESS_PENDING}
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className={headingClass}>Tracking</h3>
        {applicant.shipments.length === 0 ? (
          <p className={cn(TEXT.body, "text-quiet")}>No tracking yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-buzzField border border-line">
            {applicant.shipments.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="w-12 shrink-0 text-xs text-quiet">
                  {carrierLabel(s.carrier)}
                </span>
                <span className="min-w-0 flex-1 break-all text-primary">
                  #{s.trackingNumber}
                </span>
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
                {update && (
                  <button
                    type="button"
                    aria-label={`Edit #${s.trackingNumber}`}
                    className={iconButtonClass}
                    disabled={update.isPending}
                    onClick={() => {
                      setEditingId(s.id);
                      setTn(s.trackingNumber);
                      setCarrier(s.carrier);
                      setError(null);
                    }}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`remove-shipment-${s.id}`}
                  aria-label={`Remove #${s.trackingNumber}`}
                  className={iconButtonClass}
                  disabled={remove.isPending}
                  onClick={() => {
                    setError(null);
                    remove
                      .mutateAsync(s.id)
                      .catch(fail("Could not remove tracking."));
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
            <option value="">Auto-detect</option>
            <option value="ups">UPS</option>
            <option value="fedex">FedEx</option>
            <option value="unknown">Unknown</option>
          </Select>
          <Button
            type="submit"
            variant="primary"
            size="compact"
            data-testid={`add-shipment-${applicant.id}`}
            disabled={!tn.trim() || add.isPending || update?.isPending}
          >
            {editingId ? "Save" : "Add"}
          </Button>
          {editingId && (
            <Button
              type="button"
              size="compact"
              onClick={() => {
                setEditingId(null);
                setTn("");
                setCarrier("");
              }}
            >
              Cancel edit
            </Button>
          )}
        </form>
      </section>
      {setDelivered && (
        <Checkbox
          data-testid={`delivered-${applicant.id}`}
          checked={applicant.deliveredAt != null}
          disabled={setDelivered.isPending}
          onChange={(e) => {
            setError(null);
            setDelivered
              .mutateAsync(e.target.checked)
              .catch(fail("Could not save delivery."));
          }}
          label={
            applicant.deliveredAt != null
              ? `Delivered ${formatDate(applicant.deliveredAt)}`
              : "Mark delivered"
          }
        />
      )}
      <ModalActions onCancel={onClose} cancelLabel="Done" />
    </Modal>
  );
}
