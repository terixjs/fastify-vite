import { Readable } from 'stream'

export function createHtmlTemplateFunction(source) {
  const ranges = new Map()
  const interpolated = ['']
  const params = []

  for (const match of source.matchAll(/<!--\s*([\.\w]+)\s*-->/g)) {
    ranges.set(match.index, {
      param: match[1],
      end: match.index + match[0].length,
    })
  }

  let cursor = 0
  const cut = null
  let range = null

  for (let i = 0; i < source.length; i++) {
    if (i === cut) {
      interpolated.push('')
      cursor += 1
    } else if (ranges.get(i)) {
      range = ranges.get(i)
      params.push(range.param)
      interpolated.push({ param: range.param })
      i = range.end
      interpolated.push('')
      cursor += 2
    }
    interpolated[cursor] += source[i]
  }

  // https://stackoverflow.com/questions/21616264/what-does-0-eval-do
  // biome-ignore lint/style/noCommaOperator: indirect call to eval() to ensure global scope
  const compiledTemplatingFunction = (0, eval)(
    // biome-ignore lint/style/useTemplate: needed for compiling
    `(asReadable) => (function ({ ${[
      ...new Set(params.map((s) => s.split('.')[0])),
    ].join(', ')} }) {` +
      `return asReadable\`${interpolated.map((s) => serialize(s)).join('')}\`` +
      '})',
  )(asReadable)

  return compiledTemplatingFunction
}

function asReadable(fragments, ...values) {
  return Readable.from(
    (async function* () {
      for (const fragment of fragments) {
        yield fragment
        if (values.length) {
          const value = values.shift()
          if (value instanceof Readable) {
            for await (const chunk of value) {
              yield chunk
            }
          } else if (value && typeof value !== 'string') {
            yield value.toString()
          } else {
            yield value ?? ''
          }
        }
      }
    })(),
  )
}

function serialize(frag) {
  if (typeof frag === 'object') {
    return `$\{${frag.param}}`
  }
  return frag
}
