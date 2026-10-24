import type { BairroId } from '@/domain/heatIndexTypes'

/**
 * A raw CSV file bundled at build time. `content` is the unparsed text: this
 * module is the only place that knows where the data comes from.
 */
export type CsvSource = {
  bairroId: BairroId
  bairroLabel: string
  /** Bundler path of the file (useful for diagnostics). */
  path: string
  content: string
}

const csvModules = import.meta.glob('../../data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function basenameWithoutExtension(path: string): string {
  const fileName = path.slice(path.lastIndexOf('/') + 1)
  return fileName.replace(/\.csv$/i, '')
}

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** `Cabiúnas.csv` -> `cabiunas` */
export function toBairroId(label: string): BairroId {
  return stripDiacritics(label).trim().toLowerCase().replace(/\s+/g, '-')
}

/** `cabiunas.csv` -> `Cabiunas` (first letter upper case, remainder preserved) */
export function toBairroLabel(fileName: string): string {
  const clean = stripDiacritics(fileName).trim()
  if (clean === '') return clean
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/**
 * Every CSV bundled from `data/`, sorted by label using the pt-BR collation.
 * No network access: the files are part of the bundle in this version.
 */
export function listSources(): CsvSource[] {
  return Object.entries(csvModules)
    .map(([path, content]) => {
      const bairroLabel = toBairroLabel(basenameWithoutExtension(path))
      return { bairroId: toBairroId(bairroLabel), bairroLabel, path, content }
    })
    .sort((a, b) => a.bairroLabel.localeCompare(b.bairroLabel, 'pt-BR'))
}
