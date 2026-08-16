export function mockRuntimeStub() {
  const virtualId = '\0apimind-test-mock-runtime';

  return {
    name: 'apimind-test-mock-runtime-stub',
    enforce: 'pre',
    resolveId(id) {
      return id === '@apimind/mockjs-safe' ? virtualId : null;
    },
    load(id) {
      return id === virtualId
        ? 'export default { Random: { extend() {} }, mock: value => value };'
        : null;
    }
  };
}
