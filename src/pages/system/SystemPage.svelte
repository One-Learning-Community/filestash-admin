<script lang="ts">
  import { onMount } from "svelte"
  import { toast } from "svelte-sonner"
  import { getAdminConfig, getHealth, getPublicConfig, type Health } from "$lib/api/endpoints"
  import { apiUrl } from "$lib/api/http"
  import { backupFile, backupName, parseBackup } from "$lib/config/backup"
  import { saveConfig } from "$lib/config/save"
  import { isLeaf, isOn, toValues, type Schema } from "$lib/config/schema"
  import { confirm } from "$lib/confirm.svelte"
  import { t } from "$lib/i18n"
  import { Button } from "$lib/components/ui/button"
  import { Skeleton } from "$lib/components/ui/skeleton"

  // ---- health ----
  let health = $state<Health | null>(null)
  let checking = $state(false)
  async function check() {
    checking = true
    try {
      health = await getHealth()
    } catch {
      health = { status: "error", reason: t("Can't reach the server") }
    } finally {
      checking = false
    }
  }

  // ---- web console: only on servers that offer it (Linux builds) and have it on ----
  let shell = $state<"off" | "on" | "absent">("absent")
  async function loadConsole() {
    try {
      const admin = await getAdminConfig()
      const el = ((admin.features as Schema | undefined)?.server as Schema | undefined)?.console_enable
      shell = isLeaf(el) ? (isOn(el, el.value) ? "on" : "off") : "absent"
    } catch {
      shell = "absent"
    }
  }

  onMount(() => {
    void check()
    void loadConsole()
  })

  // ---- backup and restore ----
  let downloading = $state(false)
  async function download() {
    downloading = true
    try {
      const [admin, pub] = await Promise.all([getAdminConfig(), getPublicConfig()])
      const values = toValues(admin)
      delete values.constant
      const blob = new Blob([backupFile({ values, connections: pub.connections ?? [] })], { type: "application/json" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = backupName()
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      toast.error(t("Couldn't download the backup: {{VALUE}}", err instanceof Error ? err.message : String(err)))
    } finally {
      downloading = false
    }
  }

  let fileInput = $state<HTMLInputElement | null>(null)
  let restoring = $state(false)
  async function restore(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    const backup = parseBackup(await file.text())
    if (typeof backup === "string") {
      toast.error(t("Can't restore {{NAME}}: {{REASON}}", { NAME: file.name, REASON: backup }))
      return
    }
    const ok = await confirm({
      title: t("Replace the whole configuration?"),
      body: t("Every setting, storage and login method is replaced by the ones in {{VALUE}}. The admin password becomes the one in the backup. If the backup has a different secret key, everyone is signed out and you log in again to finish.", file.name),
      confirmLabel: t("Restore"),
      destructive: true,
    })
    if (!ok) return
    restoring = true
    try {
      await saveConfig(() => ({ values: backup.values, connections: backup.connections }))
      toast.success(t("Configuration restored. Some settings take effect after a restart."))
      void check()
      void loadConsole()
    } catch (err) {
      toast.error(t("Couldn't restore: {{VALUE}}", err instanceof Error ? err.message : String(err)))
    } finally {
      restoring = false
    }
  }
</script>

<div class="max-w-2xl space-y-8">
  <h1 class="text-2xl font-semibold">{t("System")}</h1>

  <section class="space-y-3" aria-labelledby="health-title">
    <div class="flex items-center justify-between gap-3">
      <h2 id="health-title" class="text-lg font-medium">{t("Health")}</h2>
      <Button variant="outline" size="sm" onclick={check} disabled={checking}>{t("Check again")}</Button>
    </div>
    {#if health === null}
      <Skeleton class="h-10 w-full" />
    {:else if health.status === "pass"}
      <p class="text-sm" role="status">{t("Healthy: the configuration is readable and complete, and the server answers.")}</p>
    {:else}
      <div class="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm" role="status">
        <p>
          {health.status === "transcient" ? t("Running, with a configuration problem:") : t("Problem found:")}
          <code>{health.reason ?? health.status}</code>
        </p>
        {#if health.debug}
          <pre class="overflow-x-auto text-xs">{health.debug.join("\n")}</pre>
        {/if}
      </div>
    {/if}
    <p class="text-muted-foreground text-sm">
      {t("The same check monitoring tools can use, at")} <a class="underline" href={apiUrl("healthz")} target="_blank" rel="noreferrer">/healthz</a>.
    </p>
  </section>

  <section class="space-y-3" aria-labelledby="backup-title">
    <h2 id="backup-title" class="text-lg font-medium">{t("Backup and restore")}</h2>
    <p class="text-muted-foreground text-sm">
      {t("A backup holds every setting, storage and login method. It includes passwords and keys in plain text, so keep it somewhere safe.")}
    </p>
    <div class="flex flex-wrap gap-2">
      <Button variant="outline" onclick={download} disabled={downloading}>{t("Download backup")}</Button>
      <Button variant="outline" onclick={() => fileInput?.click()} disabled={restoring}>
        {restoring ? t("Restoring…") : t("Restore from a backup…")}
      </Button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" class="hidden" onchange={restore} data-testid="restore-file" />
    </div>
  </section>

  {#if shell !== "absent"}
    <section class="space-y-3" aria-labelledby="console-title">
      <h2 id="console-title" class="text-lg font-medium">{t("Web console")}</h2>
      {#if shell === "on"}
        <p class="text-muted-foreground text-sm">
          {t("A shell on the server, in the browser. It asks for the admin password. If it doesn't open, restart the server: turning it on takes effect after a restart.")}
        </p>
        <Button variant="outline" href={apiUrl("admin/tty/")} target="_blank" rel="noreferrer">{t("Open the web console")}</Button>
      {:else}
        <p class="text-muted-foreground text-sm">
          {t("Off. Turn it on in Settings, under Server, then restart the server.")}
        </p>
      {/if}
    </section>
  {/if}
</div>
