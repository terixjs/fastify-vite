import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { renderToStream } from '@kitajs/html/suspense.js'
import * as devalue from 'devalue'
import { findStaticImports, resolvePath } from 'mlly'

export default {
  prepareClient,
  createHtmlFunction,
  createRouteHandler,
}

const kPrefetch = Symbol('kPrefetch')

async function prepareClient(clientModule, scope, config) {
  if (!clientModule) {
    return null
  }
  const { routes } = clientModule
  for (const route of routes) {
    // Predecorate Request and Reply objects
    if (route.decorateRequest) {
      for (const prop of route.decorateRequest) {
        !scope.hasRequestDecorator(prop) && scope.decorateRequest(prop, null)
      }
    }
    if (route.decorateReply) {
      for (const prop of route.decorateReply) {
        !scope.hasReplyDecorator(prop) && scope.decorateReply(prop, null)
      }
    }
    // Pregenerate prefetching <head> elements
    const { css, svg, js } = await findClientImports(
      config.vite.root,
      route.modulePath,
    )
    route[kPrefetch] = ''
    for (const stylesheet of css) {
      if (config.dev) {
        route[kPrefetch] += `  <link rel="stylesheet" href="/${stylesheet}">\n`
      } else if (config.ssrManifest[stylesheet]) {
        const [asset] = config.ssrManifest[stylesheet].filter((s) =>
          s.endsWith('.css'),
        )
        route[kPrefetch] +=
          `  <link rel="stylesheet" href="${asset}" crossorigin>\n`
      }
    }
    for (const image of svg) {
      if (config.dev) {
        route[kPrefetch] +=
          `  <link as="image" rel="preload" href="/${image}" fetchpriority="high">\n`
      } else if (config.ssrManifest[image]) {
        const [asset] = config.ssrManifest[image].filter((s) =>
          s.endsWith('.svg'),
        )
        route[kPrefetch] +=
          `  <link as="image" rel="preload" href="${asset}" fetchpriority="high">\n`
      }
    }
    for (const script of js) {
      if (config.dev) {
        route[kPrefetch] += `<script src="/${script}" type="module"></script>\n`
      } else if (config.ssrManifest[script]) {
        const [asset] = config.ssrManifest[script].filter((s) =>
          s.endsWith('.js'),
        )
        route[kPrefetch] +=
          `<script src="${asset}" type="module" crossorigin></script>\n`
      }
    }
  }
  return Object.assign({}, clientModule, { routes })
}

// The return value of this function gets registered as reply.html()
export function createHtmlFunction(source, scope, config) {
  const htmlTemplate = config.createHtmlTemplateFunction(source)
  return function (ctx) {
    this.type('text/html')
    this.send(htmlTemplate(ctx))
    return this
  }
}

export function createRouteHandler({ client, route }, scope, config) {
  if (route.fragment) {
    return async (req, reply) => {
      req.route = route
      reply.type('text/html')
      reply.send(await route.default({ app: scope, req, reply, client, route }))
    }
  }
  return async (req, reply) => {
    req.route = route
    reply.html({
      head: await renderHead(client, route, {
        app: scope,
        req,
        reply,
        client,
        route,
      }),
      element: renderToStream((rid) =>
        client.root({
          app: scope,
          req,
          reply,
          rid,
          children: route.default({
            app: scope,
            client,
            route,
            req,
            reply,
            rid,
          }),
        }),
      ),
    })
    return reply
  }
}

async function renderHead(client, route, ctx) {
  let rendered = ''
  if (route[kPrefetch]) {
    rendered += route[kPrefetch]
  }
  if (route.head === 'function') {
    rendered += await route.head(ctx)
  } else if (route.head) {
    rendered += route.head
  }
  rendered += '\n'
  if (client.head === 'function') {
    rendered += await client.head(ctx)
  } else if (client.head) {
    rendered += client.head
  }
  return rendered
}

async function findClientImports(
  root,
  path,
  { js = [], css = [], svg = [] } = {},
) {
  const source = await readFile(join(root, path), 'utf8')
  const specifiers = (
    await Promise.all(
      findStaticImports(source).map(async ({ specifier }) => {
        if (extname(specifier)) {
          return specifier
        }
        const resolved = resolve(dirname(path), specifier)

        // resolve the file extension which allows for
        // resolved client imports without specified extensions
        try {
          const filePathWithExtension = await resolvePath(
            join(root, resolved),
            {
              extensions: ['.mjs', '.cjs', '.js', '.ts', '.tsx'],
            },
          )
          const specifier = filePathWithExtension.replace(root, '')

          return specifier
        } catch (e) {
          return ''
        }
      }),
    )
  ).filter((specifier) => {
    return specifier.match(/\.((svg)|(css)|(m?js)|(tsx?)|(jsx?))$/)
  })

  for (const specifier of specifiers) {
    const resolved = resolve(dirname(path), specifier)
    if (specifier.match(/\.svg$/)) {
      svg.push(resolved.slice(1))
    }
    if (specifier.match(/\.client\.((m?js)|(tsx?)|(jsx?))$/)) {
      js.push(resolved.slice(1))
    }
    if (specifier.match(/\.css$/)) {
      css.push(resolved.slice(1))
    }
    if (specifier.match(/\.((m?js)|(tsx?)|(jsx?))$/)) {
      const submoduleImports = await findClientImports(root, resolved)
      js.push(...submoduleImports.js)
      css.push(...submoduleImports.css)
      svg.push(...submoduleImports.svg)
    }
  }
  return { js, css, svg }
}
