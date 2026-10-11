import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * The site's TypeScript uses extensionless imports. Node's type stripper does
 * not rewrite those specifiers, so tests register this resolver.
 */
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('.') || specifier.startsWith('/'))
    && !path.extname(specifier)
    && context.parentURL
  ) {
    const parent = fileURLToPath(context.parentURL)
    const base = path.resolve(path.dirname(parent), specifier)
    for (const ext of ['.ts', '.tsx', '.mts', '.mjs', '.js', '.json']) {
      const file = existsSync(base + ext) ? base + ext : path.join(base, `index${ext}`)
      if (existsSync(file) && !file.endsWith(path.sep) && path.extname(file)) {
        return {
          shortCircuit: true,
          url: pathToFileURL(file).href,
        }
      }
    }
  }
  return nextResolve(specifier, context)
}
