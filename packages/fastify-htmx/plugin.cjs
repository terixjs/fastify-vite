const { readFileSync, existsSync } = require('fs')
const { dirname, join, resolve } = require('path')
const { fileURLToPath } = require('url')
const inject = require('@rollup/plugin-inject')

function viteFastifyHtmx(config = {}) {
  const prefix = /^\/:/
  const virtualRoot = resolve(__dirname, 'virtual')
  const virtualModules = [
    'client.js',
    'layouts/',
    'layouts.js',
    'routes.js',
    'root.jsx',
  ]
  virtualModules.includes = function (virtual) {
    if (!virtual) {
      return false
    }
    for (const entry of this) {
      if (virtual.startsWith(entry)) {
        return true
      }
    }
    return false
  }

  let viteProjectRoot

  function loadVirtualModuleOverride(virtual) {
    if (!virtualModules.includes(virtual)) {
      return
    }
    const overridePath = resolve(viteProjectRoot, virtual)
    if (existsSync(overridePath)) {
      return overridePath
    }
  }

  function loadVirtualModule(virtual) {
    if (!virtualModules.includes(virtual)) {
      return
    }
    const code = readFileSync(resolve(virtualRoot, virtual), 'utf8')
    return {
      code,
      map: null,
    }
  }

  return [
    inject({
      htmx: 'htmx.org',
      Html: '@kitajs/html',
    }),
    {
      name: 'vite-plugin-fastify-htmx',
      config(config, { command }) {
        config.esbuild = {
          jsxFactory: 'Html.createElement',
          jsxFragment: 'Html.Fragment',
        }
        if (command === 'build' && config.build?.ssr) {
          config.build.rollupOptions = {
            output: {
              format: 'es',
            },
          }
        }
      },
      configResolved(config) {
        viteProjectRoot = config.root
      },
      async resolveId(id) {
        const [, virtual] = id.split(prefix)
        if (virtual) {
          const override = await loadVirtualModuleOverride(virtual)
          if (override) {
            return override
          }
          return id
        }
      },
      load(id, options) {
        if (options?.ssr && (id.endsWith('.client.js') || id.endsWith('.client.ts'))) {
          return {
            code: '',
            map: null,
          }
        }
        const [, virtual] = id.split(prefix)
        return loadVirtualModule(virtual)
      },
    },
  ]
}

module.exports = viteFastifyHtmx
