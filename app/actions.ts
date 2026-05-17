"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { normalizeUIStatus, type UIStatus } from "@/lib/utils";

export async function createDeal(input: {
  listing_id?: number | null;
  deal_date: string;
  vin?: string | null;
  make: string;
  model?: string | null;
  province?: string | null;
  stage: UIStatus;
  ui_status?: UIStatus;
  price?: number | null;
  profit_cad?: number | null;
  notes?: string | null;
  url?: string | null;
  mmr_link?: string | null;
}) {
  const supabase = await createClient();
  const stage = normalizeUIStatus(input.stage);
  const payload = {
    ...input,
    stage,
    ui_status: normalizeUIStatus(input.ui_status ?? stage),
  };
  const { data, error } = await supabase
    .from("manual_deals")
    .insert(payload)
    .select()
    .single();
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/analytics");
  return { ok: true, deal: data };
}

export async function updateDeal(id: string, patch: Partial<{
  listing_id: number | null;
  deal_date: string;
  vin: string | null;
  make: string;
  model: string | null;
  province: string | null;
  stage: UIStatus;
  ui_status: UIStatus;
  price: number | null;
  profit_cad: number | null;
  notes: string | null;
  url: string | null;
  mmr_link: string | null;
}>) {
  const supabase = await createClient();
  const normalizedStatus = patch.ui_status ? normalizeUIStatus(patch.ui_status) : patch.stage ? normalizeUIStatus(patch.stage) : null;
  const payload = {
    ...patch,
    ...(normalizedStatus ? { stage: normalizedStatus, ui_status: normalizedStatus } : {}),
  };
  const { error } = await supabase.from("manual_deals").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function deleteDeal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("manual_deals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/deals");
  revalidatePath("/analytics");
  return { ok: true };
}

export async function updateDealUiStatus(dealId: string, uiStatus: UIStatus) {
  const supabase = await createClient();
  const normalizedStatus = normalizeUIStatus(uiStatus);
  const { error } = await supabase
    .from("manual_deals")
    .update({ ui_status: normalizedStatus, stage: normalizedStatus })
    .eq("id", dealId);

  if (error) return { error: error.message };

  revalidatePath("/deals");
  revalidatePath("/");
  return { ok: true };
}
