// The "users" text of the htpasswd login method: one `name:hash` line per user,
// optionally followed by more /etc/shadow fields (`name:hash:19306:0:...`).
// Edits rewrite only the line they touch, so comments, blank lines and lines
// the server reads but this console doesn't are kept as they were.
import bcrypt from "bcryptjs"

export type HtpasswdUser = { name: string; line: number }

const lines = (text: string) => (text === "" ? [] : text.split("\n"))

// a line the server would try to sign someone in with: it splits on the first ":"
export function listUsers(text: string): HtpasswdUser[] {
  const out: HtpasswdUser[] = []
  lines(text).forEach((l, line) => {
    const i = l.indexOf(":")
    if (i > 0 && !l.startsWith("#")) out.push({ name: l.slice(0, i), line })
  })
  return out
}

export function addUser(text: string, name: string, hash: string): string {
  const all = lines(text)
  // keep the list free of an empty last line, so the new user isn't after a gap
  while (all.length > 0 && all[all.length - 1].trim() === "") all.pop()
  return [...all, `${name}:${hash}`].join("\n")
}

// replaces the hash only; shadow fields after it stay
export function setHash(text: string, line: number, hash: string): string {
  const all = lines(text)
  const [name, , ...rest] = all[line].split(":")
  all[line] = [name, hash, ...rest].join(":")
  return all.join("\n")
}

export function removeUser(text: string, line: number): string {
  const all = lines(text)
  all.splice(line, 1)
  return all.join("\n")
}

// Why a name can't be used, or "" when it can. The server matches names exactly.
export function nameProblem(name: string, users: HtpasswdUser[]): "empty" | "colon" | "space" | "taken" | "" {
  if (name === "") return "empty"
  if (name.includes(":")) return "colon"
  if (/\s/.test(name)) return "space"
  if (users.some((u) => u.name === name)) return "taken"
  return ""
}

// another user whose name differs only in upper/lower case
export const similarName = (name: string, users: HtpasswdUser[]) =>
  users.find((u) => u.name !== name && u.name.toLowerCase() === name.toLowerCase())?.name ?? null

// Filestash's htpasswd plugin only takes bcrypt hashes labelled $2a$. bcryptjs
// writes $2b$, which is the same hash for any password under 255 bytes, and
// bcrypt only reads the first 72 anyway.
export async function hashPassword(password: string): Promise<string> {
  return (await bcrypt.hash(password, 10)).replace(/^\$2b\$/, "$2a$")
}
