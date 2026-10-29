// Google Drive and Dropbox storages sign in through an OAuth app whose keys the
// server reads from auth.gdrive and auth.dropbox. The server only creates those
// keys, as hidden fields, the first time someone uses such a storage, so the
// settings page adds them as editable fields here.

import { isLeaf } from "./schema"
import type { FormElement, Schema } from "$lib/types"
import { t } from "$lib/i18n"

type Field = { type: string; description: () => string }

const redirect = () => t("Its redirect URI must be https://<your host>/login, using the Host from General.")

export const APP_KEYS: Record<string, Record<string, Field>> = {
  gdrive: {
    client_id: { type: "text", description: () => t("Client ID of the Google Cloud OAuth client that Google Drive storages sign in with.") + " " + redirect() },
    client_secret: { type: "password", description: () => t("Client secret of that OAuth client.") },
  },
  dropbox: {
    client_id: { type: "text", description: () => t("App key of the Dropbox app that Dropbox storages sign in with.") + " " + redirect() },
  },
}

export function withAppKeys(schema: Schema): Schema {
  const auth = { ...((schema.auth as Schema | undefined) ?? {}) }
  for (const [app, fields] of Object.entries(APP_KEYS)) {
    const current = auth[app] && !isLeaf(auth[app]) ? (auth[app] as Schema) : {}
    const next: Schema = { ...current }
    for (const [name, f] of Object.entries(fields)) {
      const old = current[name]
      const el: FormElement = {
        label: name,
        type: f.type,
        description: f.description(),
        readonly: false,
        required: false,
        default: null,
        value: isLeaf(old) ? old.value : null,
      }
      next[name] = el
    }
    auth[app] = next
  }
  return { ...schema, auth }
}

// Leaves out apps whose keys are all empty, so saving doesn't add empty keys to the config.
export function withoutEmptyAppKeys(auth: Record<string, unknown>): Record<string, unknown> {
  const out = { ...auth }
  for (const app of Object.keys(APP_KEYS)) {
    const v = out[app]
    if (typeof v !== "object" || v === null) continue
    if (Object.values(v).every((x) => x === null || x === undefined || x === "")) delete out[app]
  }
  return out
}
