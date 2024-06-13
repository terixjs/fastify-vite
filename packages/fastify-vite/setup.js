import { parse as parsePath } from 'node:path'
import { join, walk, ensure, exists, write, read } from './ioutils.js'

export async function ejectBlueprint(base, { root, renderer }) {
  await ensure(root)
  for await (const { stats, path } of walk(join(renderer.path, 'blueprint'))) {
    const filePath = join(root, path)
    const { dir: fileDir } = parsePath(filePath)
    await ensure(fileDir)
    if (!stats.isDirectory() && !exists(filePath)) {
      const bfilePath = join(renderer.path, 'blueprint', path)
      await write(filePath, await read(bfilePath, 'utf8'))
    }
  }
}

export async function ensureConfigFile(base, { root, renderer }) {
  const sourcePath = join(renderer.path, 'config.mjs')
  const targetPath = join(base, 'vite.config.js')
  if (exists(sourcePath) && !exists(targetPath)) {
    const generatedConfig = await read(sourcePath, 'utf8')
    await write(targetPath, generatedConfig)
  }
  return targetPath
}

export default { ensureConfigFile, ejectBlueprint }
