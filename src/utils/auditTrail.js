import { supabase } from "../supabaseClient";

export function getSessionUser() {
  try {
    return JSON.parse(sessionStorage.getItem("stn_user") || "null");
  } catch {
    return null;
  }
}

export function getPerformedBy(user) {
  if (!user) return "Unknown";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "Unknown";
}

/**
 * Insert one or more rows into audit_trail. Fails silently with a console warning
 * so that audit errors never block the primary operation.
 * @param {object[]} records
 */
export async function insertAuditTrail(records) {
  const { error } = await supabase.from("audit_trail").insert(records);
  if (error) console.warn("Audit trail insert failed:", error.message);
}
