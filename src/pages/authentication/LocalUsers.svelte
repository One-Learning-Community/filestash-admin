<script lang="ts">
  // People who can sign in with the "Local users" login method. Each change is
  // saved on the server straight away, from its own dialog.
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"
  import { deleteLocalUser, getLocalUsers, saveLocalUser, type LocalUser } from "$lib/api/endpoints"
  import { t } from "$lib/i18n"
  import { confirm } from "$lib/confirm.svelte"
  import * as Dialog from "$lib/components/ui/dialog"
  import { Button } from "$lib/components/ui/button"
  import { Input } from "$lib/components/ui/input"
  import { Label } from "$lib/components/ui/label"
  import { Switch } from "$lib/components/ui/switch"
  import { Skeleton } from "$lib/components/ui/skeleton"

  let users = $state<LocalUser[] | null>(null)
  let failed = $state(false)

  async function load() {
    failed = false
    try {
      users = (await getLocalUsers()) ?? []
    } catch {
      failed = true
    }
  }
  onMount(load)

  type Form = { email: string; password: string; role: string; disabled: boolean }
  const empty = (): Form => ({ email: "", password: "", role: "", disabled: false })

  let open = $state(false)
  // the user being edited; null while adding one
  let editing = $state<LocalUser | null>(null)
  let form = $state<Form>(empty())
  let initial: Form = empty()
  let busy = $state(false)
  const touched = $derived(JSON.stringify(form) !== JSON.stringify(initial))
  // the server keeps a password it gets back only when it is one of its own hashes
  const keepable = $derived(editing !== null && editing.password.startsWith("$2a$"))

  const emailTaken = $derived(
    editing === null && (users ?? []).some((u) => u.email === form.email.trim().toLowerCase()),
  )
  const problem = $derived(
    form.email.trim() === ""
      ? t("Enter an email address.")
      : emailTaken
        ? t("There is already a user with this email.")
        : (editing === null || !keepable) && form.password.trim() === ""
          ? t("Enter a password.")
          : "",
  )

  function add() {
    editing = null
    form = empty()
    initial = empty()
    open = true
  }

  function edit(u: LocalUser) {
    editing = u
    form = { email: u.email, password: "", role: u.role ?? "", disabled: u.disabled ?? false }
    initial = { ...form }
    open = true
  }

  async function save() {
    if (problem || busy) return
    busy = true
    try {
      await saveLocalUser({
        email: form.email.trim(),
        // an empty password would be stored as the new password, so an edit
        // that leaves it blank sends the stored one back
        password: editing !== null && form.password.trim() === "" ? editing.password : form.password,
        role: form.role,
        disabled: form.disabled,
      })
      toast.success(editing === null ? t("User added") : t("User saved"))
      open = false
      await load()
    } catch (err) {
      toast.error(t("Couldn't save: {{VALUE}}", err instanceof Error ? err.message : String(err)))
    } finally {
      busy = false
    }
  }

  async function requestClose() {
    if (touched && !busy) {
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

  async function remove(u: LocalUser) {
    const ok = await confirm({
      title: t("Delete {{VALUE}}?", u.email),
      body: t("They won't be able to sign in any more. This can't be undone."),
      confirmLabel: t("Delete"),
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteLocalUser(u.email)
      toast.success(t("User deleted"))
      await load()
    } catch (err) {
      toast.error(t("Couldn't delete: {{VALUE}}", err instanceof Error ? err.message : String(err)))
    }
  }
</script>

<section class="space-y-3" aria-labelledby="local-users-title">
  <div class="flex items-center justify-between gap-3">
    <h2 id="local-users-title" class="text-lg font-medium">{t("Users")}</h2>
    <Button variant="outline" size="sm" onclick={add} disabled={users === null}>{t("Add user")}</Button>
  </div>

  {#if failed}
    <div class="space-y-2">
      <p class="text-sm">{t("Couldn't load the users.")}</p>
      <Button size="sm" onclick={load}>{t("Retry")}</Button>
    </div>
  {:else if users === null}
    <Skeleton class="h-16 w-full" />
  {:else if users.length === 0}
    <p class="text-muted-foreground text-sm">{t("No users yet. Add one so people can sign in.")}</p>
  {:else}
    <ul class="divide-y rounded-md border">
      {#each users as u (u.email)}
        <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
          <span class="min-w-0 flex-1 truncate font-medium">{u.email}</span>
          {#if u.role}<span class="text-muted-foreground">{u.role}</span>{/if}
          {#if u.disabled}<span class="text-muted-foreground">{t("Disabled")}</span>{/if}
          <Button variant="ghost" size="sm" onclick={() => edit(u)} aria-label={t("Edit {{VALUE}}", u.email)}>{t("Edit")}</Button>
          <Button variant="ghost" size="sm" onclick={() => remove(u)} aria-label={t("Delete {{VALUE}}", u.email)}>{t("Delete")}</Button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<Dialog.Root bind:open={() => open, (v) => (v ? (open = true) : void requestClose())}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{editing === null ? t("Add user") : t("Edit {{VALUE}}", editing.email)}</Dialog.Title>
      <Dialog.Description>
        {editing === null
          ? t("If email is set up in Settings, they get an invitation with their password.")
          : keepable
            ? t("Leave the password empty to keep the current one.")
            : t("Enter a new password for this user.")}
      </Dialog.Description>
    </Dialog.Header>
    <form class="space-y-4" onsubmit={(e) => (e.preventDefault(), void save())}>
      <div class="space-y-2">
        <Label for="user-email">{t("Email")}</Label>
        <Input id="user-email" type="email" autocomplete="off" bind:value={form.email} disabled={editing !== null} />
      </div>
      <div class="space-y-2">
        <Label for="user-password">{t("Password")}</Label>
        <Input id="user-password" type="password" autocomplete="new-password" bind:value={form.password} />
      </div>
      <div class="space-y-2">
        <Label for="user-role">{t("Roles")}</Label>
        <Input id="user-role" autocomplete="off" bind:value={form.role} placeholder={t("Comma-separated, e.g. admin, finance")} />
      </div>
      <div class="flex items-center gap-3">
        <Switch id="user-disabled" checked={form.disabled} onCheckedChange={(c) => (form.disabled = c)} />
        <Label for="user-disabled">{t("Disabled")}</Label>
      </div>
      {#if problem && (form.email !== "" || form.password !== "")}
        <p class="text-destructive text-sm">{problem}</p>
      {/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={requestClose}>{t("Cancel")}</Button>
        <Button type="submit" disabled={problem !== "" || busy}>{busy ? t("Saving…") : t("Save")}</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
