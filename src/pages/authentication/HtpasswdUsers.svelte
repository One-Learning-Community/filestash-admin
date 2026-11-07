<script lang="ts">
  // People who can sign in with the htpasswd login method, edited in place of its
  // "users" text. Passwords are hashed here in the browser; only the rewritten
  // text goes to the server, with the page's Save.
  import { t } from "$lib/i18n"
  import { confirm } from "$lib/confirm.svelte"
  import { addUser, hashPassword, listUsers, nameProblem, removeUser, setHash, similarName, type HtpasswdUser } from "$lib/config/htpasswd"
  import * as Dialog from "$lib/components/ui/dialog"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"

  // unsaved: the list differs from what the server has
  let { value = $bindable(), unsaved = false }: { value?: string; unsaved?: boolean } = $props()

  const text = $derived(typeof value === "string" ? value : "")
  const users = $derived(listUsers(text))

  let open = $state(false)
  // the user whose password is being changed; null while adding one
  let editing = $state<HtpasswdUser | null>(null)
  let name = $state("")
  let password = $state("")
  let busy = $state(false)

  const problem = $derived.by(() => {
    if (editing === null) {
      switch (nameProblem(name.trim(), users)) {
        case "empty": return t("Enter a name or email.")
        case "colon": return t("A name can't contain \":\".")
        case "space": return t("A name can't contain spaces.")
        case "taken": return t("There is already a user with this name.")
      }
    }
    return password === "" ? t("Enter a password.") : ""
  })
  const similar = $derived(editing === null ? similarName(name.trim(), users) : null)

  function add() {
    editing = null
    name = ""
    password = ""
    open = true
  }

  function change(u: HtpasswdUser) {
    editing = u
    name = u.name
    password = ""
    open = true
  }

  async function save() {
    if (problem || busy) return
    busy = true
    try {
      const hash = await hashPassword(password)
      value = editing === null ? addUser(text, name.trim(), hash) : setHash(text, editing.line, hash)
      open = false
    } finally {
      busy = false
    }
  }

  async function requestClose() {
    if (busy) return
    if (password !== "" || (editing === null && name !== "")) {
      const ok = await confirm({
        title: t("Discard changes?"),
        body: t("Your unsaved changes will be lost."),
        confirmLabel: t("Discard"),
        destructive: true,
      })
      if (!ok) return
    }
    open = false
  }

  async function remove(u: HtpasswdUser) {
    const ok = await confirm({
      title: t("Delete {{VALUE}}?", u.name),
      body: t("They won't be able to sign in once you save."),
      confirmLabel: t("Delete"),
      destructive: true,
    })
    if (ok) value = removeUser(text, u.line)
  }
</script>

<section class="space-y-3" aria-labelledby="htpasswd-users-title">
  <div class="flex items-center justify-between gap-3">
    <h2 id="htpasswd-users-title" class="text-lg font-medium">{t("Users")}</h2>
    <Button variant="outline" size="sm" onclick={add}>{t("Add user")}</Button>
  </div>

  {#if unsaved}
    <p role="status" class="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
      {t("These user changes aren't applied yet. Save the page to apply them.")}
    </p>
  {/if}

  {#if users.length === 0}
    <p class="text-muted-foreground text-sm">{t("No users yet. Add one so people can sign in.")}</p>
  {:else}
    <ul class="divide-y rounded-md border">
      {#each users as u (u.line)}
        <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
          <span class="min-w-0 flex-1 truncate font-medium">{u.name}</span>
          <Button variant="ghost" size="sm" onclick={() => change(u)} aria-label={t("Change password for {{VALUE}}", u.name)}>{t("Change password")}</Button>
          <Button variant="ghost" size="sm" onclick={() => remove(u)} aria-label={t("Delete {{VALUE}}", u.name)}>{t("Delete")}</Button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<Dialog.Root bind:open={() => open, (v) => (v ? (open = true) : void requestClose())}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{editing === null ? t("Add user") : t("Change password for {{VALUE}}", editing.name)}</Dialog.Title>
      <Dialog.Description>{t("The password is hashed in your browser. Save the page to apply it.")}</Dialog.Description>
    </Dialog.Header>
    <form class="space-y-4" onsubmit={(e) => (e.preventDefault(), void save())}>
      {#if editing === null}
        <div class="space-y-2">
          <Label for="htpasswd-name">{t("Name or email")}</Label>
          <Input id="htpasswd-name" autocomplete="off" autocapitalize="off" spellcheck={false} bind:value={name} />
        </div>
      {/if}
      <div class="space-y-2">
        <Label for="htpasswd-password">{t("Password")}</Label>
        <Input id="htpasswd-password" type="password" autocomplete="new-password" bind:value={password} />
      </div>
      <!-- space is kept for one line, so the dialog doesn't jump when a message appears -->
      <div class="min-h-5 text-sm" aria-live="polite">
        {#if problem && (name !== "" || password !== "")}
          <p class="text-destructive">{problem}</p>
        {:else if similar}
          <p>{t("Names are case-sensitive: this is a new user.")}</p>
        {/if}
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={requestClose}>{t("Cancel")}</Button>
        <Button type="submit" disabled={problem !== "" || busy}>{busy ? t("Hashing…") : editing === null ? t("Add") : t("Set password")}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
