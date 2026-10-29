import { describe, expect, it } from "vitest"
import { backupFile, parseBackup } from "./backup"

const hash = "$2a$10$" + "a".repeat(53)
const good = { general: { secret_key: "abcdABCD12345678" }, auth: { admin: hash }, connections: [{ type: "s3", label: "S3" }] }

describe("parseBackup", () => {
  it("reads back what a backup writes, without the constants", () => {
    const parsed = parseBackup(backupFile({ values: { ...good, connections: undefined, constant: undefined } as never, connections: good.connections }))
    expect(parsed).toEqual({ values: { general: good.general, auth: good.auth }, connections: good.connections })
    expect(parseBackup(JSON.stringify({ ...good, constant: { user: "x" } }))).not.toHaveProperty("values.constant")
  })
  it("refuses a file that isn't JSON or isn't an object", () => {
    expect(typeof parseBackup("nope")).toBe("string")
    expect(typeof parseBackup("[1]")).toBe("string")
  })
  it("refuses a file that would lock the admin out", () => {
    expect(typeof parseBackup(JSON.stringify({ ...good, auth: {} }))).toBe("string")
    expect(typeof parseBackup(JSON.stringify({ ...good, auth: { admin: "plain" } }))).toBe("string")
  })
  it("refuses a bad secret key or malformed storages", () => {
    expect(typeof parseBackup(JSON.stringify({ ...good, general: { secret_key: "short" } }))).toBe("string")
    expect(typeof parseBackup(JSON.stringify({ ...good, connections: [{ label: "no type" }] }))).toBe("string")
  })
  it("treats a missing storage list as no storages", () => {
    const { connections: _c, ...rest } = good
    expect(parseBackup(JSON.stringify(rest))).toMatchObject({ connections: [] })
  })
})
