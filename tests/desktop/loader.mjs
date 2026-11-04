const STUB = new URL('./sdk-stub.mjs', import.meta.url).href

export async function resolve(specifier, context, next) {
  if (specifier === '@hermes/plugin-sdk') {
    return { url: STUB, shortCircuit: true }
  }
  return next(specifier, context)
}
