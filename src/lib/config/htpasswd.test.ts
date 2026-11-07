import { describe, expect, it } from "vitest"
import bcrypt from "bcryptjs"
import { addUser, hashPassword, listUsers, nameProblem, removeUser, setHash, similarName } from "./htpasswd"

const text = [
  "# staff",
  "ann:$apr1$ZiAIyyhS$ovyMo9eJRgDF/luvmAigP0",
  "",
  "bob:$6$ME6DxvSEUjW4Kx/j$vQ5Y:19306:0:99999:7:::",
  "not a user line",
].join("\n")

describe("htpasswd users", () => {
  it("lists the lines the server signs people in with", () => {
    expect(listUsers(text)).toEqual([
      { name: "ann", line: 1 },
      { name: "bob", line: 3 },
    ])
    expect(listUsers("")).toEqual([])
  })

  it("adds a user at the end, without a gap", () => {
    expect(addUser("", "cy", "H")).toBe("cy:H")
    expect(addUser("ann:A\n\n", "cy", "H")).toBe("ann:A\ncy:H")
  })

  it("changes one hash and keeps everything else, shadow fields included", () => {
    const out = setHash(text, 3, "NEW")
    expect(out.split("\n")).toEqual([
      "# staff",
      "ann:$apr1$ZiAIyyhS$ovyMo9eJRgDF/luvmAigP0",
      "",
      "bob:NEW:19306:0:99999:7:::",
      "not a user line",
    ])
    expect(setHash("ann:old", 0, "NEW")).toBe("ann:NEW")
  })

  it("removes only that user's line", () => {
    expect(removeUser(text, 1).split("\n")).toEqual(["# staff", "", "bob:$6$ME6DxvSEUjW4Kx/j$vQ5Y:19306:0:99999:7:::", "not a user line"])
  })

  it("checks names the way the server matches them", () => {
    const users = listUsers(text)
    expect(nameProblem("", users)).toBe("empty")
    expect(nameProblem("a:b", users)).toBe("colon")
    expect(nameProblem("a b", users)).toBe("space")
    expect(nameProblem("ann", users)).toBe("taken")
    expect(nameProblem("Ann", users)).toBe("")
    expect(similarName("Ann", users)).toBe("ann")
    expect(similarName("cy", users)).toBeNull()
  })

  it("hashes as $2a$ bcrypt, the only bcrypt label the server accepts", async () => {
    const h = await hashPassword("test1234")
    expect(h).toMatch(/^\$2a\$10\$.{53}$/)
    expect(bcrypt.compareSync("test1234", h)).toBe(true)
  })
})
