import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function requireMasterOrFinanceiro() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/"); // Default redirect if something fails
  }

  const role = (profile.role || "").toUpperCase();

  if (role === "GESTOR") {
    redirect("/"); // Deny access to Gestores
  }
}
