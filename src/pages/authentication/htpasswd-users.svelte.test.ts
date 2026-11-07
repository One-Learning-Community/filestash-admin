import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte"
import { flushSync } from "svelte"
import bcrypt from "bcryptjs"
import { confirmState } from "$lib/confirm.svelte"
import ConfirmDialog from "$lib/components/ConfirmDialog.svelte"
import HtpasswdUsers from "./HtpasswdUsers.svelte"

const start = ["# staff", "ann:$apr1$ZiAIyyhS$ovyMo9eJRgDF/luvmAigP0", "bob:$6$salt$hash:19306:0:99999:7:::"].join("\n")

function setup(value = start) {
  const props = $state({ value })
  render(ConfirmDialog)
  render(HtpasswdUsers, { props })
  return props
}

describe("htpasswd users", () => {
  afterEach(() => {
    cleanup()
    confirmState.current = null
  })

  it("lists the names and never the hashes", () => {
    setup()
    expect(screen.getByText("ann")).toBeInTheDocument()
    expect(screen.getByText("bob")).toBeInTheDocument()
    expect(screen.queryByText(/\$apr1\$|\$6\$/)).toBeNull()
  })

  it("changing a password rewrites only that user's hash", async () => {
    const props = setup()
    await fireEvent.click(screen.getByRole("button", { name: "Change password for bob" }))
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "new-pw" } })
    await fireEvent.click(screen.getByRole("button", { name: "Set password" }))
    await waitFor(() => expect(props.value).not.toBe(start))
    const [comment, ann, bob] = props.value.split("\n")
    expect([comment, ann]).toEqual(["# staff", "ann:$apr1$ZiAIyyhS$ovyMo9eJRgDF/luvmAigP0"])
    const [, hash, ...shadow] = bob.split(":")
    expect(shadow.join(":")).toBe("19306:0:99999:7:::")
    expect(hash.startsWith("$2a$")).toBe(true)
    expect(bcrypt.compareSync("new-pw", hash)).toBe(true)
  })

  it("adds a user with a hashed password", async () => {
    const props = setup("")
    expect(screen.getByText("No users yet. Add one so people can sign in.")).toBeInTheDocument()
    await fireEvent.click(screen.getByRole("button", { name: "Add user" }))
    await fireEvent.input(screen.getByLabelText("Name or email"), { target: { value: " cy@x.org " } })
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "pw" } })
    await fireEvent.click(screen.getByRole("button", { name: "Add" }))
    await waitFor(() => expect(props.value).toMatch(/^cy@x\.org:\$2a\$10\$/))
    expect(bcrypt.compareSync("pw", props.value.split(":")[1])).toBe(true)
  })

  it("checks the name before adding", async () => {
    setup()
    await fireEvent.click(screen.getByRole("button", { name: "Add user" }))
    const dialog = within(screen.getByRole("dialog"))
    await fireEvent.input(screen.getByLabelText("Password"), { target: { value: "pw" } })
    const name = screen.getByLabelText("Name or email")
    await fireEvent.input(name, { target: { value: "ann" } })
    expect(dialog.getByText("There is already a user with this name.")).toBeInTheDocument()
    await fireEvent.input(name, { target: { value: "a:b" } })
    expect(dialog.getByText("A name can't contain \":\".")).toBeInTheDocument()
    expect(dialog.getByRole("button", { name: "Add" })).toBeDisabled()
    await fireEvent.input(name, { target: { value: "Ann" } })
    expect(dialog.getByText("Names are case-sensitive: this is a new user.")).toBeInTheDocument()
    expect(dialog.getByRole("button", { name: "Add" })).toBeEnabled()
  })

  it("asks before deleting", async () => {
    const props = setup()
    await fireEvent.click(screen.getByRole("button", { name: "Delete ann" }))
    await waitFor(() => expect(confirmState.current?.title).toBe("Delete ann?"))
    confirmState.current?.resolve(true)
    await waitFor(() => expect(props.value).toBe(["# staff", "bob:$6$salt$hash:19306:0:99999:7:::"].join("\n")))
    flushSync()
    expect(screen.queryByText("ann")).toBeNull()
  })
})
