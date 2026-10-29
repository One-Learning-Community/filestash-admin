import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte"

vi.mock("$lib/api/endpoints", () => ({
  getLocalUsers: vi.fn(),
  saveLocalUser: vi.fn(),
  deleteLocalUser: vi.fn(),
  getSession: vi.fn(async () => true),
  login: vi.fn(),
}))
vi.mock("svelte-sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import * as api from "$lib/api/endpoints"
import { confirmState } from "$lib/confirm.svelte"
import LocalUsers from "./LocalUsers.svelte"

const hash = "$2a$10$" + "h".repeat(53)

describe("local users", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.getLocalUsers).mockResolvedValue([{ email: "ann@x.org", password: hash, role: "admin" }])
    vi.mocked(api.saveLocalUser).mockResolvedValue(undefined)
    vi.mocked(api.deleteLocalUser).mockResolvedValue(undefined)
  })
  afterEach(() => {
    cleanup()
    confirmState.current = null
  })

  it("lists users", async () => {
    render(LocalUsers)
    expect(await screen.findByText("ann@x.org")).toBeTruthy()
    expect(screen.getByText("admin")).toBeTruthy()
  })

  it("an edit that leaves the password empty sends the stored one back", async () => {
    render(LocalUsers)
    await fireEvent.click(await screen.findByRole("button", { name: "Edit ann@x.org" }))
    await fireEvent.input(screen.getByLabelText("Roles"), { target: { value: "admin, finance" } })
    await fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(api.saveLocalUser).toHaveBeenCalled())
    expect(vi.mocked(api.saveLocalUser).mock.calls[0][0]).toEqual({
      email: "ann@x.org", password: hash, role: "admin, finance", disabled: false,
    })
  })

  it("a new user needs a password and an unused email", async () => {
    render(LocalUsers)
    await fireEvent.click(await screen.findByRole("button", { name: "Add user" }))
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "ANN@x.org" } })
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    expect(screen.getByText("There is already a user with this email.")).toBeTruthy()
    await fireEvent.input(screen.getByLabelText("Email"), { target: { value: "bob@x.org" } })
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "pw" } })
    await fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(api.saveLocalUser).toHaveBeenCalledWith({ email: "bob@x.org", password: "pw", role: "", disabled: false }))
  })

  it("asks before deleting", async () => {
    render(LocalUsers)
    await fireEvent.click(await screen.findByRole("button", { name: "Delete ann@x.org" }))
    await waitFor(() => expect(confirmState.current?.title).toBe("Delete ann@x.org?"))
    confirmState.current?.resolve(true)
    await waitFor(() => expect(api.deleteLocalUser).toHaveBeenCalledWith("ann@x.org"))
  })
})
