import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Remote, admin-editable app config (support email, AdMob IDs, billing). Public, non-secret values only. */
export interface GeneralSettings {
  support_email: string;
  maintenance: boolean;
  maintenance_message: string;
  min_version: string;
}
export interface AdmobSettings {
  enabled: boolean;
  app_id: string;
  banner_id: string;
  interstitial_id: string;
  rewarded_id: string;
}
export interface BillingSettings {
  package_name: string;
  license_key_note: string;
}
export interface AppSettings {
  general: GeneralSettings;
  admob: AdmobSettings;
  billing: BillingSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: { support_email: "", maintenance: false, maintenance_message: "", min_version: "" },
  admob: { enabled: true, app_id: "", banner_id: "", interstitial_id: "", rewarded_id: "" },
  billing: { package_name: "", license_key_note: "" },
};

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("key,value");
  const out: AppSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of data ?? []) {
    if (row.key in out) {
      const k = row.key as keyof AppSettings;
      (out as unknown as Record<string, object>)[k] = { ...out[k], ...(row.value as object) };
    }
  }
  if (typeof window !== "undefined") {
    (window as unknown as { TTTConfig?: AppSettings }).TTTConfig = out;
  }
  return out;
}

export function useAppSettings() {
  return useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings, staleTime: 5 * 60_000 });
}

export function useIsAdmin(enabled: boolean) {
  return useQuery({
    queryKey: ["is-admin"],
    enabled,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin");
      return data === true;
    },
  });
}
