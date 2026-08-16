export interface RequestDescriptor<TBody> {
  url: string;
  body: TBody;
}

export function createInterfaceUpdateRequest<T extends Record<string, unknown>>(
  params: T,
  id: string
): RequestDescriptor<T & { id: string }> {
  const body = params as T & { id: string };
  body.id = id;
  return { url: '/api/interface/up', body };
}

export function createProjectTagUpdateRequest<TTag>(
  id: string | number,
  tag: readonly TTag[]
): RequestDescriptor<{ id: string | number; tag: readonly TTag[] }> {
  return { url: '/api/project/up_tag', body: { id, tag } };
}

export function createSchemaPreviewRequest(
  schema: unknown
): RequestDescriptor<{ schema: unknown }> {
  return { url: '/api/interface/schema2json', body: { schema } };
}
