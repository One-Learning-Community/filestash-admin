import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte"
import DraftHarness from "./SchemaForm.draft-harness.svelte"
import Harness from "./SchemaForm.harness.svelte"
import type { Schema } from "$lib/types"

const el = (type: string, label: string, extra: Record<string, unknown> = {}) => ({
  label, type, default: null, value: null, readonly: false, required: false, ...extra,
})

const sftp: Schema = {
  hostname: el("text", "Hostname", { value: "h" }),
  advanced: el("enable", "Advanced", { target: ["sftp_port"], value: false }),
  port: el("number", "Port", { id: "sftp_port", value: 22 }),
}

describe("SchemaForm", () => {
  afterEach(cleanup)

  it("an enable field is a switch that saves its value and shows its targets while on", async () => {
    render(Harness, { schema: sftp, values: { hostname: "h", advanced: false, port: 22 } })
    expect(screen.queryByLabelText("Port")).toBeNull()
    await fireEvent.click(screen.getByRole("switch", { name: "Advanced" }))
    expect(screen.getByLabelText("Port")).toBeVisible()
    expect(JSON.parse(screen.getByTestId("out").textContent!)).toMatchObject({ advanced: true })
  })

  it("an enable field with no value follows its default", () => {
    render(Harness, { schema: { enable: el("enable", "Enable", { default: true }) }, values: { enable: null } })
    expect(screen.getByRole("switch", { name: "Enable" })).toHaveAttribute("aria-checked", "true")
  })

  it("skips sub-sections with nothing to show", () => {
    render(Harness, { schema: { gdrive: { client_id: el("hidden", "client_id") } }, values: {} })
    expect(screen.queryByRole("heading")).toBeNull()
  })

  it("shows a read-only image as an image", () => {
    render(Harness, { schema: { image: el("image", "image", { readonly: true, value: "data:image/svg+xml;base64,AA==" }) }, values: {} })
    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/svg+xml;base64,AA==")
  })

  it("suggests the remaining values of a multi-value field", async () => {
    render(Harness, { schema: { roles: el("text", "Roles", { multi: true, datalist: ["a", "b", "c"] }) }, values: { roles: "a" } })
    const options = [...document.querySelectorAll("datalist option")].map((o) => (o as HTMLOptionElement).value)
    expect(options).toEqual(["a, b", "a, c"])
  })

  it("adds a note for a known field path", () => {
    render(Harness, { schema: { port: el("number", "Port") }, values: {}, prefix: "general." })
    expect(screen.getByText("Takes effect after a restart.")).toBeTruthy()
  })

  it("number empty binds null", async () => {
    const values = { port: 22 }
    render(Harness, { schema: { port: el("number", "Port", { value: 22 }) }, values })
    await fireEvent.input(screen.getByLabelText("Port"), { target: { value: "" } })
    expect(screen.getByTestId("out").textContent).toBe(JSON.stringify({ port: null }))
  })

  it("unknown type falls back to text input", () => {
    render(Harness, { schema: { dir: el("directory", "Dir", { value: "/x" }) }, values: { dir: "/x" } })
    expect(screen.getByRole("textbox", { name: "Dir" })).toHaveValue("/x")
  })

  it("names inputs by dot-path and skips hidden keys", () => {
    render(Harness, {
      schema: { a: { b: el("text", "B", { value: "1" }) }, skip: el("text", "Skip", { value: "x" }) },
      values: { a: { b: "1" }, skip: "x" },
      hidden: ["skip"],
      prefix: "p.",
    })
    expect(screen.getByLabelText("B")).toHaveAttribute("name", "p.a.b")
    expect(screen.queryByLabelText("Skip")).toBeNull()
  })

  const nested: Schema = { sec: { name: el("text", "Name", { value: "x" }) } }

  it("nested edits reach the root when the section object is missing", async () => {
    render(Harness, { schema: nested, values: {} })
    await fireEvent.input(screen.getByLabelText("Name"), { target: { value: "typed" } })
    expect(screen.getByTestId("out").textContent).toBe(JSON.stringify({ sec: { name: "typed" } }))
  })

  it("nested edits reach the root when values are pre-populated", async () => {
    render(Harness, { schema: nested, values: { sec: { name: "x" } } })
    await fireEvent.input(screen.getByLabelText("Name"), { target: { value: "typed" } })
    expect(screen.getByTestId("out").textContent).toBe(JSON.stringify({ sec: { name: "typed" } }))
  })

  it("rendering does not dirty a draft; typing does", async () => {
    render(DraftHarness, { schema: nested })
    expect(screen.getByTestId("dirty").textContent).toBe("false")
    await fireEvent.input(screen.getByLabelText("Name"), { target: { value: "typed" } })
    expect(screen.getByTestId("dirty").textContent).toBe("true")
  })

  it("does not create objects for hidden sections", () => {
    render(Harness, { schema: { ...nested, other: { n: el("text", "N", { value: "" }) } }, values: {}, hidden: ["other"] })
    expect(screen.getByTestId("out").textContent).toBe(JSON.stringify({ sec: {} }))
  })

  it("long_text never grows past its container", () => {
    const long = "x".repeat(300)
    render(Harness, { schema: { users: el("long_text", "Users", { placeholder: long }) }, values: {} })
    const cls = screen.getByLabelText("Users").className
    for (const c of ["w-full", "min-w-0", "max-w-full", "field-sizing-fixed", "whitespace-pre-wrap"]) expect(cls).toContain(c)
  })
})
