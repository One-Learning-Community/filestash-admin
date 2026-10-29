// Checks, notes and helpers for single form fields.

import { isLeaf } from "./schema"
import type { FormElement, Schema } from "$lib/types"
import { fieldLabel, t } from "$lib/i18n"

const blank = (v: unknown) => v === null || v === undefined || v === ""

// What's wrong with a value, by the field's own rules (required, pattern); null when fine.
export function fieldError(el: FormElement, value: unknown): string | null {
  if (el.readonly || el.type === "hidden") return null
  if (blank(value)) return el.required ? t("Required") : null
  if (el.pattern && typeof value === "string") {
    let re: RegExp
    try {
      re = new RegExp(`^(?:${el.pattern})$`, "u")
    } catch {
      return null
    }
    if (!re.test(value)) return patternHint(el.pattern) ?? t("Doesn't match the expected format")
  }
  return null
}

// "[a-zA-Z0-9]{16}" reads as "16 letters or digits"; other patterns get no description
function patternHint(pattern: string): string | null {
  const m = /^\[a-zA-Z0-9\]\{(\d+)\}$/.exec(pattern)
  return m ? t("Must be exactly {{VALUE}} letters or digits", m[1]) : null
}

// A random value for a field whose pattern is a fixed number of letters or digits.
export function generated(el: FormElement): string | null {
  const m = el.pattern ? /^\[a-zA-Z0-9\]\{(\d+)\}$/.exec(el.pattern) : null
  if (!m) return null
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  const bytes = crypto.getRandomValues(new Uint8Array(Number(m[1])))
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

// Every field with a problem, as "Label: problem", walking nested sections.
// Fields an off switch hides are still checked: their values are saved too.
export function formErrors(schema: Schema, values: Record<string, unknown> | undefined): string[] {
  const out: string[] = []
  for (const [key, node] of Object.entries(schema)) {
    const v = values?.[key]
    if (isLeaf(node)) {
      const err = fieldError(node, v)
      if (err) out.push(`${fieldLabel(node.label)}: ${err}`)
    } else {
      out.push(...formErrors(node, typeof v === "object" && v !== null ? (v as Record<string, unknown>) : undefined))
    }
  }
  return out
}

// Suggestions for a comma-separated multi-value field, as the old admin offered them:
// what's typed so far, followed by each option not used yet.
export function multicomplete(input: string, options: string[]): string[] {
  const typed = input.trim().replace(/,$/, "")
  const used = typed.split(",").map((s) => s.trim()).filter(Boolean)
  return options.filter((o) => !used.includes(o)).map((o) => (typed === "" ? o : `${typed}, ${o}`))
}

// Notes the server's own descriptions leave out, by field path.
export const NOTES: Record<string, () => string> = {
  "general.port": () => t("Takes effect after a restart."),
  "general.host": () => t("If the server has an APPLICATION_URL environment variable, it replaces this value at every start."),
  "general.secret_key": () =>
    t("Changing it signs everyone out, you included, and breaks existing shared links. The console signs you back in and re-saves the login method settings, which are encrypted with this key."),
  "auth.admin": () => t("If the server has an ADMIN_PASSWORD environment variable, it replaces this value at every start."),
  "auth.gdrive.client_id": () => t("Used when the server has no GDRIVE_CLIENT_ID environment variable."),
  "auth.gdrive.client_secret": () => t("Used when the server has no GDRIVE_CLIENT_SECRET environment variable."),
  "auth.dropbox.client_id": () => t("A DROPBOX_CLIENT_ID environment variable on the server takes priority over this value."),
  "features.workflow.enable": () => t("Takes effect after a restart."),
  "features.site.enable": () => t("Takes effect after a restart."),
  "features.mcp.enable": () => t("Takes effect after a restart."),
  "features.office.enable": () => t("Takes effect after a restart."),
  "features.video.enable_transcoder": () => t("Takes effect after a restart."),
  "features.protection.enable": () => t("Takes effect after a restart."),
  "features.protection.disable_svg": () => t("Takes effect after a restart."),
  "features.server.console_enable": () =>
    t("Takes effect after a restart. Gives a shell on the server, at /admin/tty/, to anyone with the admin password."),
}
