import { describe, expect, it } from "vitest"
import { at, enabled, settingsSections, subSections } from "./sections"

const el = (type: string, extra: Record<string, unknown> = {}) => ({
  label: "x", type, default: null, value: null, ...extra,
})

describe("settingsSections", () => {
  it("lists sections with fields first, then each group's sub-sections", () => {
    const schema = {
      general: { name: el("text") },
      features: { share: { enable: el("boolean") }, search: { timeout: el("number") } },
      email: { server: el("text") },
    }
    expect(settingsSections(schema as never)).toEqual([
      { slug: "general", path: ["general"], group: null },
      { slug: "email", path: ["email"], group: null },
      { slug: "share", path: ["features", "share"], group: "features" },
      { slug: "search", path: ["features", "search"], group: "features" },
    ])
  })

  it("gives a section's sub-objects their own sections when they have a field to show", () => {
    const schema = {
      auth: { admin: el("bcrypt"), gdrive: { client_id: el("text") }, dropbox: { client_id: el("hidden") } },
      features: { share: { enable: el("boolean") } },
    }
    const sections = settingsSections(schema as never)
    expect(sections).toEqual([
      { slug: "auth", path: ["auth"], group: null },
      { slug: "gdrive", path: ["auth", "gdrive"], group: "auth" },
      { slug: "share", path: ["features", "share"], group: "features" },
    ])
    expect(subSections(sections, sections[0])).toEqual(["gdrive"])
    expect(subSections(sections, sections[1])).toEqual([])
  })

  it("prefixes a sub-section whose name another section already uses", () => {
    const schema = { auth: { admin: el("bcrypt") }, features: { auth: { enable: el("boolean") } } }
    expect(settingsSections(schema as never).map((s) => s.slug)).toEqual(["auth", "features-auth"])
  })
})

describe("enabled", () => {
  it("reads the enable field, falling back to its default", () => {
    const node = { enable: el("boolean", { default: true }), other: el("text") }
    expect(enabled(node, { enable: null })).toBe(true)
    expect(enabled(node, { enable: false })).toBe(false)
  })
  it("uses an enable-type field when there is no field named enable", () => {
    expect(enabled({ enable_transcoder: el("enable", { default: false }) }, {})).toBe(false)
  })
  it("is null when the section has no switch", () => {
    expect(enabled({ timeout: el("number") }, {})).toBeNull()
  })
})

describe("at", () => {
  it("follows a path and is undefined past a missing key", () => {
    expect(at({ a: { b: 1 } }, ["a", "b"])).toBe(1)
    expect(at({ a: 1 }, ["a", "b"])).toBeUndefined()
  })
})
