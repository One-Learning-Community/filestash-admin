<script lang="ts">
  import bcrypt from "bcryptjs"
  import { coerce, isOn } from "$lib/config/schema"
  import { fieldError, generated, multicomplete } from "$lib/config/fields"
  import type { FormElement } from "$lib/types"
  import { Input } from "$lib/components/ui/input"
  import { Textarea } from "$lib/components/ui/textarea"
  import { Switch } from "$lib/components/ui/switch"
  import { Label } from "$lib/components/ui/label"
  import * as Select from "$lib/components/ui/select"
  import { Button } from "$lib/components/ui/button"
  import Help from "./Help.svelte"
  import { fieldLabel, optionLabel, t } from "$lib/i18n"

  let { el, name, value = $bindable(), note }: { el: FormElement; name: string; value?: unknown; note?: string } = $props()

  let reveal = $state(false)
  const text = $derived(value === null || value === undefined ? "" : String(value))
  const listId = $derived(`${name}-list`)
  const suggestions = $derived(el.datalist ? (el.multi ? multicomplete(text, el.datalist) : el.datalist) : [])
  // shown once the field has been left, so typing isn't flagged mid-way
  let touched = $state(false)
  const error = $derived(touched ? fieldError(el, value) : null)
  const errorId = $derived(`${name}-error`)
  const canGenerate = $derived(!el.readonly && generated(el) !== null)

  function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => (value = reader.result as string)
    reader.readAsDataURL(file)
  }

  function hash() {
    if (text !== "" && !/^\$2[abxy]\$\d\d\$/.test(text)) value = bcrypt.hashSync(text, 10)
  }
</script>

{#if el.type === "hidden"}
  <!-- value is kept, nothing rendered -->
{:else}
  <div class="space-y-2">
    {#if el.type === "boolean" || el.type === "enable"}
      <div class="flex items-center gap-3">
        <Switch id={name} {name} disabled={el.readonly} checked={isOn(el, value)} onCheckedChange={(c) => (value = coerce(el, c))} />
        <Label for={name}>{fieldLabel(el.label)}</Label>
      </div>
    {:else}
      {#if !(el.type === "image" && el.readonly)}<Label for={name}>{fieldLabel(el.label)}</Label>{/if}
      {#if el.type === "long_text" || el.type === "json"}
        <Textarea id={name} {name} class="field-sizing-fixed min-h-24 w-full max-w-full min-w-0 break-all whitespace-pre-wrap" placeholder={el.placeholder} disabled={el.readonly} value={text}
          oninput={(e) => (value = coerce(el, e.currentTarget.value))} />
      {:else if el.type === "password" || el.type === "long_password"}
        <div class="flex gap-2">
          <Input id={name} {name} type={reveal ? "text" : "password"} placeholder={el.placeholder} disabled={el.readonly}
            required={el.required} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
            value={text} oninput={(e) => (value = coerce(el, e.currentTarget.value))} onblur={() => (touched = true)} />
          <Button type="button" variant="outline" onclick={() => (reveal = !reveal)}>{reveal ? t("Hide") : t("Show")}</Button>
          {#if canGenerate}
            <Button type="button" variant="outline" onclick={() => ((value = generated(el)), (reveal = true), (touched = true))}>{t("Generate")}</Button>
          {/if}
        </div>
      {:else if el.type === "bcrypt"}
        <Input id={name} {name} type="password" placeholder={el.placeholder} disabled={el.readonly} value={text}
          oninput={(e) => (value = coerce(el, e.currentTarget.value))} onblur={hash} />
      {:else if el.type === "number"}
        <Input id={name} {name} type="number" placeholder={el.placeholder} disabled={el.readonly} value={text}
          oninput={(e) => (value = coerce(el, e.currentTarget.value))} />
      {:else if el.type === "date" || el.type === "datetime"}
        <Input id={name} {name} type={el.type === "date" ? "date" : "datetime-local"} disabled={el.readonly} value={text}
          oninput={(e) => (value = coerce(el, e.currentTarget.value))} />
      {:else if el.type === "image" && el.readonly}
        <!-- a logo: the picture lives in the form itself, not in the saved values -->
        {@const src = text || (typeof el.value === "string" ? el.value : "")}
        {#if src}<img id={name} {src} alt={fieldLabel(el.label)} class="max-h-16 max-w-48" />{/if}
      {:else if el.type === "file" || el.type === "image"}
        <Input id={name} {name} type="file" accept={el.type === "image" ? "image/*" : undefined} disabled={el.readonly}
          onchange={onFile} />
      {:else if el.type === "select"}
        <Select.Root type="single" {name} disabled={el.readonly} value={text}
          onValueChange={(v) => (value = coerce(el, v))}>
          <Select.Trigger id={name} class="w-full">{text ? optionLabel(text) : el.placeholder || t("Select…")}</Select.Trigger>
          <Select.Content>
            {#each el.options ?? [] as opt (opt)}
              <Select.Item value={opt} label={optionLabel(opt)}>{optionLabel(opt)}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <Input id={name} {name} type="text" placeholder={el.placeholder} disabled={el.readonly} value={text}
          required={el.required} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}
          list={el.datalist ? listId : undefined} oninput={(e) => (value = coerce(el, e.currentTarget.value))}
          onblur={() => (touched = true)} />
        {#if el.datalist}
          <datalist id={listId}>
            {#each suggestions as opt (opt)}<option value={opt}></option>{/each}
          </datalist>
        {/if}
      {/if}
    {/if}
    {#if error}<p id={errorId} class="text-destructive text-sm">{error}</p>{/if}
    {#if el.description}<Help description={el.description} />{/if}
    {#if note}<p class="text-muted-foreground text-sm">{note}</p>{/if}
  </div>
{/if}
