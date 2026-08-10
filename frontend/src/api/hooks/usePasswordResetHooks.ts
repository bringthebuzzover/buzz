import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../client";

type Portal = "brand" | "admin";

export function useForgotPassword(portal: Portal) {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiFetch<{ ok: boolean }>(
        `/api/auth/${portal}/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      return data;
    },
  });
}

export function useResetPassword(portal: Portal) {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await apiFetch<{ ok: boolean }>(
        `/api/auth/${portal}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      return data;
    },
  });
}
