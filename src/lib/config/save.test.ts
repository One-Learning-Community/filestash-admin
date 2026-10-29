import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "$lib/api/http"

vi.mock("$lib/api/endpoints", () => ({
  getAdminConfig: vi.fn(),
  getPublicConfig: vi.fn(),
  postConfig: vi.fn(),
  getSession: vi.fn(),
  login: vi.fn(),
}))

import * as api from "$lib/api/endpoints"
import { session } from "$lib/session.svelte"
import { saveConfig } from "./save"

const leaf = (value: unknown) => ({ label: "l", type: "text", default: null, value })

beforeEach(() => {
  vi.resetAllMocks()
  session.loginOpen = false
  vi.mocked(api.getAdminConfig).mockResolvedValue({
    general: { name: leaf("A") },
    log: { enable: leaf(true) },
    constant: { user: leaf("x") },
  } as never)
  vi.mocked(api.getPublicConfig).mockResolvedValue({
    connections: [{ type: "s3", label: "s3", hostname: "h" }],
    auth: [],
  })
  vi.mocked(api.postConfig).mockResolvedValue(undefined)
})

describe("saveConfig", () => {
  it("merges against fresh server state", async () => {
    await saveConfig((cur) => {
      ;(cur.values.general as Record<string, unknown>).name = "B"
      return cur
    })
    expect(api.postConfig).toHaveBeenCalledWith({
      general: { name: "B" },
      log: { enable: true },
      connections: [{ type: "s3", label: "s3", hostname: "h" }],
    })
    expect(vi.mocked(api.postConfig).mock.calls[0][0]).not.toHaveProperty("constant")
  })

  it("on FORBIDDEN opens login and rethrows", async () => {
    vi.mocked(api.postConfig).mockRejectedValue(new ApiError("FORBIDDEN", "no", 401))
    await expect(saveConfig((c) => c)).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(session.loginOpen).toBe(true)
  })

  it("rethrows other errors without opening login", async () => {
    vi.mocked(api.postConfig).mockRejectedValue(new ApiError("SERVER", "boom", 500))
    await expect(saveConfig((c) => c)).rejects.toMatchObject({ code: "SERVER" })
    expect(session.loginOpen).toBe(false)
  })

  it("after a secret key change, logs back in and saves the login settings again", async () => {
    const mw = { identity_provider: { type: "local", params: '{"db":"[]"}' } }
    vi.mocked(api.getAdminConfig).mockResolvedValue({
      general: { secret_key: leaf("aaaaaaaaaaaaaaaa") },
      middleware: { identity_provider: { type: leaf("local"), params: leaf('{"db":"[]"}') } },
    } as never)
    vi.mocked(api.postConfig)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError("FORBIDDEN", "no", 401))
      .mockResolvedValueOnce(undefined)
    const done = saveConfig((cur) => {
      ;(cur.values.general as Record<string, unknown>).secret_key = "bbbbbbbbbbbbbbbb"
      return cur
    })
    await vi.waitFor(() => expect(session.loginOpen).toBe(true))
    vi.mocked(api.login).mockResolvedValue(undefined)
    await session.login("pw")
    await done
    expect(api.postConfig).toHaveBeenCalledTimes(3)
    expect(vi.mocked(api.postConfig).mock.calls[2][0]).toMatchObject({ middleware: mw })
  })

  it("saves once when the secret key doesn't change", async () => {
    vi.mocked(api.getAdminConfig).mockResolvedValue({
      general: { secret_key: leaf("aaaaaaaaaaaaaaaa") },
      middleware: { identity_provider: { params: leaf('{"x":1}') } },
    } as never)
    await saveConfig((cur) => cur)
    expect(api.postConfig).toHaveBeenCalledTimes(1)
  })
})
