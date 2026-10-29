/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest runs from the repo root, where the build lands in build/.
const bundle = resolve(process.cwd(), 'build/index.js')

describe('production bundle', () => {
  it.skipIf(!existsSync(bundle))('resolves svelte client entry, not the server build', () => {
    expect(readFileSync(bundle, 'utf8')).not.toContain('is not available on the server')
  })
})
