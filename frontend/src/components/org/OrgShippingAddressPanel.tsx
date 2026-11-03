import { useState } from "react";
import {
  useOrgShippingChangeRequestState,
  useSubmitOrgShippingChangeRequest,
} from "../../api/hooks/useOrgHooks";
import { ApiError } from "../../api/errors";
import { Button, ErrorBanner, TextField } from "../forms/controls";
import ShippingAddressFields, {
  EMPTY_SHIPPING,
  shippingToApi,
  type ShippingAddressValue,
} from "./ShippingAddressFields";
import { Card, CardHeader } from "../ui/Card";
import { Modal, ModalActions } from "../ui/Modal";
import { StatePanel } from "../ui/StatePanel";
import { shippingAddressLines, SHIPPING_CHANGE_REASON_LENGTH } from "../../utils/shippingAddress";

type Props = {
  currentAddress: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    formatted: string | null;
  };
  initialAddress: boolean;
  onInitialAddressChange: (value: ShippingAddressValue) => void;
  initialValue: ShippingAddressValue;
  initialError?: string;
};

export default function OrgShippingAddressPanel({
  currentAddress,
  initialAddress,
  onInitialAddressChange,
  initialValue,
  initialError,
}: Props) {
  const state = useOrgShippingChangeRequestState();
  const submit = useSubmitOrgShippingChangeRequest();
  const [open, setOpen] = useState(false);
  const [requestedAddress, setRequestedAddress] = useState<ShippingAddressValue>(EMPTY_SHIPPING);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = state.data?.pending;
  const latest = state.data?.latest;
  const waiting = submit.isPending;
  const lines = shippingAddressLines({
    shippingLine1: currentAddress.line1,
    shippingLine2: currentAddress.line2,
    shippingCity: currentAddress.city,
    shippingState: currentAddress.state,
    shippingPostalCode: currentAddress.postalCode,
    formatted: currentAddress.formatted,
  });

  const send = async () => {
    setError(null);
    try {
      await submit.mutateAsync({ ...shippingToApi(requestedAddress), reason: reason.trim() });
      setOpen(false);
      setReason("");
      setRequestedAddress(EMPTY_SHIPPING);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the address request.");
    }
  };

  if (initialAddress) {
    return (
      <Card kind="panel" pad="card">
        <ShippingAddressFields
          value={initialValue}
          onChange={onInitialAddressChange}
          testIdPrefix="org-profile"
          error={initialError}
        />
      </Card>
    );
  }

  return (
    <Card kind="panel" pad="card">
      <CardHeader className="mb-5" title="Shipping address" />
      <p className="mb-1 text-xs font-medium text-quiet">Current address for future shipments</p>
      <div className="text-sm leading-relaxed text-primary">
        {lines.length ? lines.map((line) => <p key={line}>{line}</p>) : <p>{currentAddress.formatted ?? "Address on file"}</p>}
      </div>
      {state.isError ? (
        <StatePanel tone="danger" className="mt-4">Couldn’t load address request status.</StatePanel>
      ) : null}
      {pending ? (
        <StatePanel tone="warn" className="mt-4">Address change request pending review.</StatePanel>
      ) : latest?.status === "denied" ? (
        <StatePanel tone="danger" className="mt-4">
          The latest address request was denied{latest.decisionReason ? `: ${latest.decisionReason}` : "."}
        </StatePanel>
      ) : latest?.status === "approved" ? (
        <StatePanel tone="success" className="mt-4">The latest address request was approved.</StatePanel>
      ) : null}
      {!pending ? (
        <div className="mt-5">
          <Button type="button" onClick={() => setOpen(true)} disabled={state.isPending}>Request address change</Button>
        </div>
      ) : null}
      {open ? (
        <Modal
          onClose={() => !waiting && setOpen(false)}
          title="Request shipping address change"
          description="A Buzz admin reviews address changes. Existing shipment destinations stay in their shipment history."
        >
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          <ShippingAddressFields
            value={requestedAddress}
            onChange={setRequestedAddress}
            testIdPrefix="org-shipping-request"
          />
          <TextField
            id="org-shipping-request-reason"
            label="Reason for change"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            error={reason.trim().length > 0 && reason.trim().length < SHIPPING_CHANGE_REASON_LENGTH.min ? "Add a little more detail." : undefined}
          />
          <ModalActions onCancel={() => setOpen(false)} cancelDisabled={waiting}>
            <Button
              variant="primary"
              onClick={() => void send()}
              disabled={
                waiting ||
                reason.trim().length < SHIPPING_CHANGE_REASON_LENGTH.min ||
                reason.trim().length > SHIPPING_CHANGE_REASON_LENGTH.max
              }
            >
              {waiting ? "Submitting…" : "Submit request"}
            </Button>
          </ModalActions>
        </Modal>
      ) : null}
    </Card>
  );
}

