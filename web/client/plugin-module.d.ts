declare const pluginRegistryPromise: Promise<
  Record<string, { module: unknown; options: unknown } | null>
>;

export default pluginRegistryPromise;
