import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function getDefaultWorkspaceName(user: User) {
  const fullName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : "";
  const firstName = fullName.split(" ")[0];

  if (firstName) return `Escritório de ${firstName}`;

  const emailName = user.email?.split("@")[0]?.trim();
  if (emailName) return `Escritório de ${emailName}`;

  return "Meu escritório";
}

async function ensureCredits(workspaceId: string) {
  const { data: existingCredits, error } = await supabase
    .from("credits")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) throw error;
  if (existingCredits) return;

  const { error: insertError } = await supabase
    .from("credits")
    .insert({ workspace_id: workspaceId, balance: 500 });

  if (insertError) throw insertError;
}

export async function ensureWorkspaceForUser(user: User) {
  const { data: existingWorkspace, error: existingError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingWorkspace) {
    await ensureCredits(existingWorkspace.id);
    return existingWorkspace;
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      user_id: user.id,
      name: getDefaultWorkspaceName(user),
      mission: null,
      products: null,
      culture: null,
      additional_notes: null,
    })
    .select("*")
    .single();

  if (workspaceError || !workspace) throw workspaceError;

  await ensureCredits(workspace.id);

  return workspace;
}
