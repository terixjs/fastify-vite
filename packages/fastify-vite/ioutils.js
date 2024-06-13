import { existsSync, lstatSync } from 'node:fs'
import { writeFile, readFile } from 'node:fs/promises'
import { join, resolve, parse, dirname, basename } from 'node:path'
import { ensureDir } from 'fs-extra'
import klaw from 'klaw'

async function * walk(dir, ignorePatterns = []) {
  const sliceAt = dir.length + (dir.endsWith('/') ? 0 : 1)
  for await (const match of klaw(dir)) {
    const pathEntry = match.path.slice(sliceAt)
    if (
      ignorePatterns.some((ignorePattern) => ignorePattern.test(match.path))
    ) {
      continue
    }
    if (pathEntry === '') {
      continue
    }
    yield { stats: match.stats, path: pathEntry }
  }
}

export {
  parse,
  join,
  resolve,
  walk,
  dirname,
  basename,
  writeFile as write,
  readFile as read,
  existsSync as exists,
  lstatSync as stat,
  ensureDir as ensure,
}
