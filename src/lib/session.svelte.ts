import { getSession, login } from "$lib/api/endpoints"

const POLL_MS = 30000

class Session {
  isAdmin = $state<boolean | null>(null)
  loginOpen = $state(false)

  #waiting: (() => void)[] = []

  requireLogin(): void {
    this.loginOpen = true
  }

  // resolves the next time the admin logs in
  nextLogin(): Promise<void> {
    return new Promise((resolve) => this.#waiting.push(resolve))
  }

  async login(password: string): Promise<void> {
    await login(password)
    this.isAdmin = true
    this.loginOpen = false
    const waiting = this.#waiting
    this.#waiting = []
    for (const resolve of waiting) resolve()
  }

  async refresh(): Promise<void> {
    let next: boolean
    try {
      next = await getSession()
    } catch {
      return
    }
    const wasAdmin = this.isAdmin === true
    this.isAdmin = next
    if (wasAdmin && !next) this.loginOpen = true
  }

  start(): () => void {
    void this.refresh()
    const timer = setInterval(() => void this.refresh(), POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void this.refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }
}

export const session = new Session()
