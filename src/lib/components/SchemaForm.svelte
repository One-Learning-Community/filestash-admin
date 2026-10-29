<script lang="ts">
  import { hasVisible, isLeaf, isOn } from "$lib/config/schema"
  import { NOTES } from "$lib/config/fields"
  import type { FormElement, Schema } from "$lib/types"
  import SchemaField from "./SchemaField.svelte"
  import SchemaForm from "./SchemaForm.svelte"
  import Help from "./Help.svelte"
  import { sectionLabel } from "$lib/i18n"

  let { schema, values = $bindable({}), prefix = "", hidden = [] }: {
    schema: Schema
    values?: Record<string, any>
    prefix?: string
    hidden?: string[]
  } = $props()

  function ensureSections() {
    for (const [key, node] of Object.entries(schema)) {
      if (!hidden.includes(key) && !isLeaf(node) && (typeof values[key] !== "object" || values[key] === null)) values[key] = {}
    }
  }
  ensureSections()
  $effect.pre(ensureSections)

  const entries = $derived(Object.entries(schema).filter(([key]) => !hidden.includes(key)))
  const banner = $derived.by(() => {
    const b = entries.find(([key, node]) => key === "banner" && isLeaf(node))
    return b ? (b[1] as FormElement).description : undefined
  })

  // leaves that a switch in the same object shows only while it is on
  const targeted = $derived(
    new Set(
      entries.flatMap(([, node]) => (isLeaf(node) && node.type === "enable" ? (node.target ?? []) : [])),
    ),
  )
  const isTargeted = (node: FormElement) => node.id !== undefined && targeted.has(node.id)
  const targetsOf = (el: FormElement) =>
    entries.filter(([, n]) => isLeaf(n) && n.id !== undefined && (el.target ?? []).includes(n.id)) as [string, FormElement][]
  const note = (key: string) => NOTES[prefix + key]?.()
</script>

<div class="space-y-4">
  {#if banner}<Help description={banner} />{/if}
  {#each entries as [key, node] (key)}
    {#if isLeaf(node)}
      {#if key === "banner"}
        <!-- rendered above -->
      {:else if node.type === "enable"}
        <SchemaField el={node} name={prefix + key} bind:value={values[key]} note={note(key)} />
        {#if isOn(node, values[key])}
          {#each targetsOf(node) as [tkey, tnode] (tkey)}
            <SchemaField el={tnode} name={prefix + tkey} bind:value={values[tkey]} note={note(tkey)} />
          {/each}
        {/if}
      {:else if !isTargeted(node)}
        <SchemaField el={node} name={prefix + key} bind:value={values[key]} note={note(key)} />
      {/if}
    {:else if hasVisible(node)}
      <section class="space-y-4">
        <h3 class="text-base font-medium">{sectionLabel(key)}</h3>
        <SchemaForm schema={node} bind:values={values[key]} prefix={prefix + key + "."} />
      </section>
    {/if}
  {/each}
</div>
