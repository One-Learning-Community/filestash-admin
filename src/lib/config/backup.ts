// A configuration backup is the server's config.json as the admin API returns it:
// every setting's value, plus the storages under "connections". Login method
// settings are in plain text there, unlike in config.json, so a backup restores
// on any server whatever its secret key.

import type { Connection } from "$lib/types"
import { t } from "$lib/i18n"

export type Backup = { values: Record<string, unknown>; connections: Connection[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)

export function backupFile(b: Backup): string {
  return JSON.stringify({ ...b.values, connections: b.connections }, null, 2) + "\n"
}

export function backupName(now = new Date()): string {
  return `filestash-config-${now.toISOString().slice(0, 10)}.json`
}

// The backup in a file, or why it can't be restored. A restore replaces the whole
// configuration, so anything that would lock the admin out is refused here.
export function parseBackup(text: string): Backup | string {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return t("This file isn't JSON.")
  }
  if (!isObj(data)) return t("This file isn't a Filestash configuration.")
  const { connections = [], constant: _constant, ...values } = data
  if (!Array.isArray(connections) || !connections.every((c) => isObj(c) && typeof c.type === "string")) {
    return t("The storages in this file aren't in the expected format.")
  }
  const general = isObj(values.general) ? values.general : {}
  const auth = isObj(values.auth) ? values.auth : {}
  if (typeof general.secret_key !== "string" || !/^[a-zA-Z0-9]{16}$/.test(general.secret_key)) {
    return t("The secret key in this file isn't 16 letters or digits.")
  }
  if (typeof auth.admin !== "string" || !/^\$2[abxy]\$\d\d\$[./A-Za-z0-9]{53}$/.test(auth.admin)) {
    return t("This file has no admin password, so restoring it would lock you out.")
  }
  return { values, connections: connections as Connection[] }
}
