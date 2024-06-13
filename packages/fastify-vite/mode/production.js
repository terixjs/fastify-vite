import { parse, resolve, join, read, exists } from '../ioutils.js'
import FastifyStatic from '@fastify/static'

function fileUrl(str) {
  if (typeof str !== 'string') {
    throw new Error('Expected a string')
  }

  let pathName = resolve(str).replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (pathName[0] !== '/') {
    pathName = `/${pathName}`
  }

  return encodeURI(`file://${pathName}`)
}

async function setup(config) {
  if (!config.bundle) {
    config.bundle = {
      dir: join(config.vite.root, config.vite.build.outDir),
    }
  }
  // For production you get the distribution version of the render function
  const { assetsDir } = config.vite.build

  const clientDist = config.spa
    ? resolve(config.bundle.dir)
    : resolve(config.bundle.dir, 'client')

  if (!exists(clientDist)) {
    throw new Error('No client distribution bundle found.')
  }

  const serverDist = resolve(config.bundle.dir, 'server')
  if (!config.spa && !exists(serverDist)) {
    throw new Error('No server distribution bundle found.')
  }
  // We also register fastify-static to serve all static files
  // in production (dev server takes of this)
  await this.scope.register(async function assetFiles(scope) {
    const root = [resolve(clientDist, assetsDir)]
    if (exists(resolve(serverDist, assetsDir))) {
      root.push(resolve(serverDist, assetsDir))
    }
    await scope.register(FastifyStatic, {
      root,
      prefix: `/${assetsDir}`,
    })
  })

  // // And again for files in the public/ folder
  // await this.scope.register(async function publicFiles(scope) {
  //   console.log('clientDist', clientDist)
  //   await scope.register(FastifyStatic, {
  //     root: clientDist,
  //     allowedPath(path) {
  //       return path !== '/index.html'
  //     },
  //   })
  // })

  // Note: this is just to ensure it works, for a real world
  // production deployment, you'll want to capture those paths in
  // Nginx or just serve them from a CDN instead

  Object.defineProperty(config, 'hasRenderFunction', {
    writable: false,
    value: typeof config.createRenderFunction === 'function',
  })

  // Load routes from client module (server entry point)
  const { module: clientModule, ssrManifest } = await loadClient()

  // Make SSR Manifest available in the config
  Object.defineProperty(config, 'ssrManifest', {
    writable: false,
    value: ssrManifest,
  })

  const client = await config.prepareClient(clientModule, this.scope, config)

  // Set reply.html() function with production version of index.html
  this.scope.decorateReply(
    'html',
    await config.createHtmlFunction(
      config.bundle.indexHtml,
      this.scope,
      config,
    ),
  )

  if (config.hasRenderFunction) {
    // Set reply.render() function with the client module production bundle
    const renderFunction = await config.createRenderFunction(
      client,
      this.scope,
      config,
    )
    this.scope.decorateReply('render', renderFunction)
  }

  return { clientDist, client, routes: client?.routes }

  // Loads the Vite application server entry point for the client
  async function loadClient() {
    if (config.spa) {
      return {}
    }
    const ssrManifestPath = resolve(
      config.bundle.dir,
      'client',
      '.vite',
      'ssr-manifest.json',
    )
    const ssrManifest =
      process.platform === 'win32'
        ? new URL(fileUrl(ssrManifestPath))
        : ssrManifestPath
    const serverFiles = [
      join('server', `${parse(config.clientModule).name}.js`),
      join('server', `${parse(config.clientModule).name}.mjs`),
    ]
    let serverBundlePath
    for (const serverFile of serverFiles) {
      // Use file path on Windows
      serverBundlePath =
        process.platform === 'win32'
          ? new URL(fileUrl(resolve(config.bundle.dir, serverFile)))
          : resolve(config.bundle.dir, serverFile)
      if (await exists(serverBundlePath)) {
        break
      }
    }
    let serverBundle = await import(serverBundlePath)
    if (typeof serverBundle.default === 'function') {
      serverBundle = await serverBundle.default(config)
    }
    return {
      module: serverBundle.default || serverBundle,
      ssrManifest: JSON.parse(await read(ssrManifest, 'utf8')),
    }
  }
}

export {
  setup,
}
