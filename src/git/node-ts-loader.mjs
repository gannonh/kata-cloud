export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith("./") || specifier.startsWith("../");
    const hasKnownExtension = /\.(mjs|cjs|js|json|node|ts)$/.test(specifier);

    if (isRelative && !hasKnownExtension) {
      return nextResolve(`${specifier}.ts`, context);
    }

    throw error;
  }
}
