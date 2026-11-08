import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Business = Tables<"businesses">;
export type Service = Tables<"services">;
export type BusinessHour = Tables<"business_hours">;
export type Appointment = Tables<"appointments">;

export const MEDIA_BUCKET = "business-media";

export function useMyBusiness() {
  return useQuery({
    queryKey: ["my-business"],
    queryFn: async () => {
      const { data: u, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!u.user) return null;
      const { data: m, error } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", u.user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!m) return null;
      const { data: b, error: e2 } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", m.business_id)
        .single();
      if (e2) throw e2;
      return b;
    },
  });
}

/** Panel pages render only after the layout has loaded the business. */
export function useBusiness(): Business {
  const { data } = useMyBusiness();
  if (!data) throw new Error("Estética não carregada");
  return data;
}

export function useMediaUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
export async function uploadMedia(businessId: string, file: File, prefix: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error("Use imagens JPG, PNG ou WEBP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${businessId}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error("Falha no envio da imagem.");
  return path;
}
