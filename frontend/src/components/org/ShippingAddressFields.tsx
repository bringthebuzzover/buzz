/**
 * Structured US ship-to fields with optional Places autocomplete.
 *
 * Suggestions come from the API (Google key stays on the server). Submit
 * always re-validates; E2E can fill the inputs without picking a suggestion.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  useAddressPreview,
  useAddressSuggest,
  type AddressSuggestionItem,
} from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import FieldError from "../forms/FieldError";

export type ShippingAddressValue = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  placeId: string;
};

export const EMPTY_SHIPPING: ShippingAddressValue = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  placeId: "",
};

export function shippingToApi(value: ShippingAddressValue) {
  const line2 = value.line2.trim();
  const placeId = value.placeId.trim();
  return {
    shippingLine1: value.line1.trim(),
    shippingLine2: line2 || undefined,
    shippingCity: value.city.trim(),
    shippingState: value.state.trim(),
    shippingPostalCode: value.postalCode.trim(),
    shippingPlaceId: placeId || undefined,
  };
}

const SUGGEST_DEBOUNCE_MS = 750;

type Props = {
  value: ShippingAddressValue;
  onChange: (next: ShippingAddressValue) => void;
  inputClass: string;
  testIdPrefix: string;
  required?: boolean;
  legacyHint?: string | null;
  error?: string;
};

export default function ShippingAddressFields({
  value,
  onChange,
  inputClass,
  testIdPrefix,
  required = true,
  legacyHint,
  error,
}: Props) {
  const suggest = useAddressSuggest();
  const preview = useAddressPreview();
  const [suggestions, setSuggestions] = useState<AddressSuggestionItem[]>([]);
  const [open, setOpen] = useState(false);
  const [streetActive, setStreetActive] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const gen = useRef(0);
  const allowSuggest = useRef(false);
  const listId = useId();

  const dismissSuggestions = () => {
    allowSuggest.current = false;
    gen.current += 1;
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const q = value.line1.trim();
    if (!streetActive || !allowSuggest.current || value.placeId || q.length < 3) {
      gen.current += 1;
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLookupError(null);
    const thisGen = ++gen.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await suggest.mutateAsync(q);
          if (thisGen !== gen.current || !allowSuggest.current) return;
          setSuggestions(data.suggestions);
          setOpen(data.suggestions.length > 0);
        } catch (err) {
          if (thisGen !== gen.current || !allowSuggest.current) return;
          setSuggestions([]);
          setOpen(false);
          if (err instanceof ApiError && err.code === "RATE_LIMITED") {
            setLookupError(
              "Suggestions paused for a moment. You can keep typing the street, city, state, and ZIP.",
            );
            return;
          }
          setLookupError(
            err instanceof ApiError
              ? err.message
              : "Address lookup is unavailable. Type the street, city, state, and ZIP.",
          );
        }
      })();
    }, SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on street activity
  }, [value.line1, value.placeId, streetActive]);

  const pick = async (item: AddressSuggestionItem) => {
    dismissSuggestions();
    setStreetActive(false);
    try {
      const filled = await preview.mutateAsync(item.placeId);
      onChange({
        line1: filled.shippingLine1,
        line2: filled.shippingLine2 ?? "",
        city: filled.shippingCity,
        state: filled.shippingState,
        postalCode: filled.shippingPostalCode,
        placeId: item.placeId,
      });
    } catch (err) {
      onChange({ ...value, line1: item.text, placeId: item.placeId });
      setLookupError(
        err instanceof ApiError
          ? err.message
          : "Could not fill that address. Check city, state, and ZIP.",
      );
    }
  };

  const patch = (partial: Partial<ShippingAddressValue>) => {
    onChange({ ...value, placeId: "", ...partial });
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-buzz-ink">
        Shipping address (US)
      </legend>
      <p className="text-xs text-buzz-inkMuted">
        Where brands should ship product. PO Boxes and campus CPO/dorm lines
        are allowed.
      </p>
      {legacyHint ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Previously saved: {legacyHint}. Enter a US street (or PO Box), city,
          state, and ZIP to keep shipping.
        </p>
      ) : null}

      <div className="relative">
        <label
          htmlFor={`${testIdPrefix}-shipping-line1`}
          className="mb-1 block text-sm font-semibold text-buzz-ink"
        >
          Street
        </label>
        <input
          id={`${testIdPrefix}-shipping-line1`}
          data-testid={`${testIdPrefix}-shipping-line1`}
          className={inputClass}
          value={value.line1}
          onChange={(e) => {
            allowSuggest.current = true;
            setStreetActive(true);
            patch({ line1: e.target.value });
          }}
          onFocus={() => {
            allowSuggest.current = true;
            setStreetActive(true);
          }}
          onBlur={() => {
            setStreetActive(false);
            dismissSuggestions();
          }}
          autoComplete="street-address"
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${testIdPrefix}-shipping-error` : undefined}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
        />
        {open && suggestions.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-buzz-lineMid bg-buzz-paper shadow-md"
          >
            {suggestions.map((item) => (
              <li key={item.placeId} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-buzz-ink hover:bg-buzz-cream"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pick(item)}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <label
          htmlFor={`${testIdPrefix}-shipping-line2`}
          className="mb-1 block text-sm font-semibold text-buzz-ink"
        >
          Apt, CPO, or PO Box{" "}
          <span className="font-normal text-buzz-inkMuted">(optional)</span>
        </label>
        <input
          id={`${testIdPrefix}-shipping-line2`}
          data-testid={`${testIdPrefix}-shipping-line2`}
          className={inputClass}
          value={value.line2}
          onChange={(e) => patch({ line2: e.target.value })}
          autoComplete="address-line2"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label
            htmlFor={`${testIdPrefix}-shipping-city`}
            className="mb-1 block text-sm font-semibold text-buzz-ink"
          >
            City
          </label>
          <input
            id={`${testIdPrefix}-shipping-city`}
            data-testid={`${testIdPrefix}-shipping-city`}
            className={inputClass}
            value={value.city}
            onChange={(e) => patch({ city: e.target.value })}
            autoComplete="address-level2"
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${testIdPrefix}-shipping-error` : undefined
            }
          />
        </div>
        <div>
          <label
            htmlFor={`${testIdPrefix}-shipping-state`}
            className="mb-1 block text-sm font-semibold text-buzz-ink"
          >
            State
          </label>
          <input
            id={`${testIdPrefix}-shipping-state`}
            data-testid={`${testIdPrefix}-shipping-state`}
            className={inputClass}
            value={value.state}
            onChange={(e) => patch({ state: e.target.value })}
            autoComplete="address-level1"
            maxLength={2}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${testIdPrefix}-shipping-error` : undefined
            }
          />
        </div>
        <div>
          <label
            htmlFor={`${testIdPrefix}-shipping-postal`}
            className="mb-1 block text-sm font-semibold text-buzz-ink"
          >
            ZIP
          </label>
          <input
            id={`${testIdPrefix}-shipping-postal`}
            data-testid={`${testIdPrefix}-shipping-postal`}
            className={inputClass}
            value={value.postalCode}
            onChange={(e) => patch({ postalCode: e.target.value })}
            autoComplete="postal-code"
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? `${testIdPrefix}-shipping-error` : undefined
            }
          />
        </div>
      </div>

      {lookupError ? (
        <p className="text-xs font-medium text-amber-900">{lookupError}</p>
      ) : null}
      <FieldError id={`${testIdPrefix}-shipping-error`} message={error} />
    </fieldset>
  );
}
