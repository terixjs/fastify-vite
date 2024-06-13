export function ensureESMBuild() {
  return {
    name: 'fastify-vite-ensure-esm-build',
    config(config, { command }) {
      if (command === 'build' && config.build?.ssr) {
        config.build.rollupOptions = {
          output: {
            format: 'es',
          },
        }
      }
    },
  }
}
