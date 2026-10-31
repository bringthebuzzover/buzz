/**
 * TanStack Query hooks for brand-side API endpoints.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client";
import { useAuth } from "../../contexts/AuthContext";
import { mergeShipment, omitShipment } from "../../utils/shipments";
import type { components } from "../generated/schema";

// Sourced from OpenAPI (`npm run gen:api`) via DataResponse[T] payloads.
export type BrandProfile = components["schemas"]["BrandProfileResponse"];
export type BrandDropItem = components["schemas"]["BrandDropListItem"];
export type BrandDropDetail = components["schemas"]["BrandDropDetailResponse"];
export type BrandDropCreativePatch =
  components["schemas"]["BrandDropCreativePatch"];
export type BrandDropPost = components["schemas"]["BrandDropPostItem"];
export type BrandDropApplicant = components["schemas"]["BrandDropDetailApplicant"];
export type BrandAggregate = components["schemas"]["BrandAggregateResponse"];
export type EngagementPoint = components["schemas"]["EngagementSeriesPoint"];
export type BrandDropRequest = components["schemas"]["BrandDropRequestResponse"];
export type BrandDropRequestDraft = components["schemas"]["BrandDropRequestCreate"];

// ── Hooks ────────────────────────────────────────────────────────────────

export function useBrandProfile() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandProfile>("/api/brands/me");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useUpdateBrandProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { brandName: string }) => {
      const { data } = await apiFetch<BrandProfile>("/api/brands/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return data;
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["brand-profile"], profile);
    },
  });
}

export type BrandIgChangeRequest = components["schemas"]["BrandIgChangeRequestResponse"];
export type BrandIgChangeRequestState = components["schemas"]["BrandIgChangeRequestState"];

export function useBrandIgChangeRequestState() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand", "ig-change"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandIgChangeRequestState>(
        "/api/brands/me/ig-change-request",
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useSubmitBrandIgChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { requestedHandle: string; reason: string }) => {
      const { data } = await apiFetch<BrandIgChangeRequest>(
        "/api/brands/me/ig-change-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand", "ig-change"] });
    },
  });
}

export function useChangeBrandPassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiFetch<components["schemas"]["TokenResponse"]>(
        "/api/auth/brand/change-password",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
  });
}

export function useBrandDrops() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drops"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropItem[]>("/api/brands/me/drops");
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useBrandDropRequests() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drop-requests"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropRequest[]>(
        "/api/brands/me/drop-requests",
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useBrandDropDetail(dropId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-drop-detail", dropId],
    queryFn: async () => {
      const { data } = await apiFetch<BrandDropDetail>(
        `/api/brands/me/drops/${dropId}`,
      );
      return data;
    },
    enabled: status === "authenticated" && !!dropId,
  });
}

export function useBrandAggregate() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["brand-aggregate"],
    queryFn: async () => {
      const { data } = await apiFetch<BrandAggregate>(
        "/api/brands/me/aggregate",
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useEngagementSeries(bucketCount = 12, windowDays = 14) {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["engagement-series", bucketCount, windowDays],
    queryFn: async () => {
      const { data } = await apiFetch<EngagementPoint[]>(
        `/api/brands/me/engagement-series?bucket_count=${bucketCount}&window_days=${windowDays}`,
      );
      return data;
    },
    enabled: status === "authenticated",
  });
}

export function useCreateBrandDropRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: BrandDropRequestDraft) => {
      const { data } = await apiFetch<BrandDropRequest>(
        "/api/brands/me/drop-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drop-requests"] });
      queryClient.invalidateQueries({ queryKey: ["brand-aggregate"] });
    },
  });
}

export function usePatchBrandDropCreative(dropId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BrandDropCreativePatch) => {
      const body: BrandDropCreativePatch = {};
      if (payload.title !== undefined) body.title = payload.title;
      if (payload.description !== undefined) body.description = payload.description;
      if (payload.image !== undefined) body.image = payload.image;
      const { data } = await apiFetch<BrandDropDetail>(
        `/api/brands/me/drops/${dropId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drop-detail", dropId] });
      queryClient.invalidateQueries({ queryKey: ["brand-drops"] });
    },
  });
}

function useBrandDropMutation<TInput>(
  dropId: string,
  request: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-drop-detail", dropId] });
      queryClient.invalidateQueries({ queryKey: ["brand-drops"] });
    },
  });
}

/** Draft one applicant's decision; the org sees nothing until Send decisions. */
export function useSetSeatDecision(dropId: string) {
  return useBrandDropMutation(
    dropId,
    (input: {
      applicationId: string;
      decision: "applied" | "accepted" | "denied";
      allocatedUnits?: number | null;
    }) =>
      apiFetch(
        `/api/brands/me/drops/${dropId}/applications/${input.applicationId}/decision`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: input.decision,
            allocatedUnits: input.allocatedUnits ?? null,
          }),
        },
      ),
  );
}

/** Send every drafted decision (repeatable). */
export function useSendDecisions(dropId: string) {
  return useBrandDropMutation(dropId, async (_: void) => {
    const { data } = await apiFetch<{ acceptedCount: number; deniedCount: number }>(
      `/api/brands/me/drops/${dropId}/send-decisions`,
      { method: "POST" },
    );
    return data;
  });
}

/** Keep the open modal and drop roster in sync after shipment changes. */
function useBrandShipmentMutation<T>(
  dropId: string,
  applicationId: string,
  method: "POST" | "PATCH" | "DELETE",
  shipmentId: (input: T) => string,
  body?: (input: T) => unknown,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: T) => {
      const { data } = await apiFetch<components["schemas"]["ShipmentItem"]>(
        `/api/brands/me/drops/${dropId}/applications/${applicationId}/shipments${method === "POST" ? "" : `/${shipmentId(input)}`}`,
        {
          method,
          ...(body ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body(input)),
          } : {}),
        },
      );
      return data;
    },
    onSuccess: (shipment, input) => {
      queryClient.setQueryData(
        ["brand-drop-detail", dropId],
        (old: BrandDropDetail | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.map((applicant) => {
              if (applicant.id !== applicationId) return applicant;
              const shipments = applicant.shipments ?? [];
              return {
                ...applicant,
                shipments: method === "DELETE"
                  ? omitShipment(shipments, shipmentId(input))
                  : method === "POST"
                    ? mergeShipment(shipments, shipment)
                    : shipments.map((row) => row.id === shipment.id ? shipment : row),
              };
            }),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["brand-drop-detail", dropId] });
      void queryClient.invalidateQueries({ queryKey: ["brand-drops"] });
    },
  });
}

type ShipmentInput = { trackingNumber: string; carrier?: string };
const shipmentBody = ({ trackingNumber, carrier }: ShipmentInput) => ({
  trackingNumber, carrier: carrier || null,
});

export function useAddBrandShipment(dropId: string, applicationId: string) {
  return useBrandShipmentMutation<ShipmentInput>(dropId, applicationId, "POST", () => "", shipmentBody);
}

export function useUpdateBrandShipment(dropId: string, applicationId: string) {
  return useBrandShipmentMutation<ShipmentInput & { shipmentId: string }>(
    dropId, applicationId, "PATCH", (input) => input.shipmentId, shipmentBody,
  );
}

export function useDeleteBrandShipment(dropId: string, applicationId: string) {
  return useBrandShipmentMutation<string>(dropId, applicationId, "DELETE", (id) => id);
}
