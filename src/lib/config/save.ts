import { getAdminConfig, getPublicConfig, postConfig } from "$lib/api/endpoints"
import { ApiError } from "$lib/api/http"
import { session } from "$lib/session.svelte"
import type { Connection } from "$lib/types"
import { toValues } from "./schema"

type Current = { values: Record<string, unknown>; connections: Connection[] }

/**
 * The server replaces the whole config on POST, so every save starts from fresh
 * server state and the patch changes only what the caller owns.
 *
 * Callers should pass `$state.snapshot(...)` of reactive state into anything that
 * clones (structuredClone throws on Svelte `$state` proxies). The patch's return
 * value is not cloned; JSON serialization in the POST handles proxies fine.
 *
 * A save that changes general.secret_key gets a second save. The server writes the
 * login method settings encrypted with keys made from the old secret, then reloads
 * and reads them with keys made from the new one, which fails. Saving them again,
 * as this save meant them to be, stores them under the new secret. The new secret also ends
 * the admin session, so the second save waits for the admin to log in again.
 */
export async function saveConfig(patch: (current: Current) => Current): Promise<void> {
  let repair: unknown = null
  await post((current) => {
    // read before patching: a patch may change current in place
    const before = secret(current.values)
    const next = patch(current)
    if (secret(next.values) !== before && hasLoginSettings(next.values.middleware)) {
      repair = JSON.parse(JSON.stringify(next.values.middleware))
    }
    return next
  })
  if (repair === null) return
  const middleware = repair
  for (;;) {
    try {
      await post(({ values, connections }) => ({ values: { ...values, middleware }, connections }))
      return
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "FORBIDDEN")) throw err
      await session.nextLogin()
    }
  }
}

async function post(patch: (current: Current) => Current): Promise<void> {
  try {
    const [admin, pub] = await Promise.all([getAdminConfig(), getPublicConfig()])
    const values = toValues(admin)
    delete values.constant
    const connections = structuredClone(pub.connections)
    const next = patch({ values, connections })
    await postConfig({ ...next.values, connections: next.connections })
  } catch (err) {
    if (err instanceof ApiError && err.code === "FORBIDDEN") session.requireLogin()
    throw err
  }
}

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {}

const secret = (values: Record<string, unknown>) => obj(values.general).secret_key

function hasLoginSettings(middleware: unknown): boolean {
  const m = obj(middleware)
  return [obj(m.identity_provider).params, obj(m.attribute_mapping).params].some(
    (p) => typeof p === "string" && p !== "" && p !== "{}",
  )
}
