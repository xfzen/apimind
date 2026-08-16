import json5 from 'json5';

type DiffRecord = Record<string, unknown>;

export interface DiffEngine {
  diff(left: unknown, right: unknown): unknown;
}

export interface DiffHtmlFormatter {
  format(delta: unknown, left: unknown): string | null | undefined;
}

export interface CurrentDiffData {
  current: unknown;
  old: unknown;
  type?: string;
}

export interface DiffViewItem {
  title: string;
  content: string | null | undefined;
}

export default function diffView(
  jsondiffpatch: DiffEngine,
  formattersHtml: DiffHtmlFormatter,
  curDiffData: CurrentDiffData | null | undefined
): DiffViewItem[] {
  const json5Parse = (json: unknown): unknown => {
    if (typeof json === 'object' && json) return json;
    try {
      return json5.parse(json as string);
    } catch {
      return json;
    }
  };

  const diffText = (left: unknown, right: unknown): string | null | undefined => {
    const normalizedLeft = left || '';
    const normalizedRight = right || '';
    if (normalizedLeft == normalizedRight) {
      return null;
    }

    const delta = jsondiffpatch.diff(normalizedLeft, normalizedRight);
    return formattersHtml.format(delta, normalizedLeft);
  };

  const diffJson = (left: unknown, right: unknown): string | null | undefined => {
    const normalizedLeft = json5Parse(left);
    const normalizedRight = json5Parse(right);
    const delta = jsondiffpatch.diff(normalizedLeft, normalizedRight);
    return formattersHtml.format(delta, normalizedLeft);
  };

  const valueMaps: Record<string, string> = {
    '1': '必需',
    '0': '非必需',
    text: '文本',
    file: '文件',
    undone: '未完成',
    done: '已完成'
  };

  const handleParams = (item: DiffRecord): DiffRecord => {
    const newItem: DiffRecord = { ...item, _id: undefined };

    Object.keys(newItem).forEach(key => {
      if (key === 'required' || key === 'type') {
        newItem[key] = valueMaps[String(newItem[key])];
      }
    });
    return newItem;
  };

  const diffArray = (
    arr1: DiffRecord[] | null | undefined,
    arr2: DiffRecord[] | null | undefined
  ): string | null | undefined => {
    const left = (arr1 || []).map(handleParams);
    const right = (arr2 || []).map(handleParams);
    return diffJson(left, right);
  };

  let result: DiffViewItem[] = [];

  if (curDiffData && typeof curDiffData === 'object' && curDiffData.current) {
    const { current, old, type } = curDiffData;
    if (type === 'wiki') {
      if (current != old) {
        result.push({
          title: 'wiki更新',
          content: diffText(old, current)
        });
      }
      return result.filter(item => item.content);
    }

    const currentRecord = current as DiffRecord;
    const oldRecord = old as DiffRecord;

    if (currentRecord.path != oldRecord.path) {
      result.push({ title: 'Api 路径', content: diffText(oldRecord.path, currentRecord.path) });
    }
    if (currentRecord.title != oldRecord.title) {
      result.push({ title: 'Api 名称', content: diffText(oldRecord.title, currentRecord.title) });
    }
    if (currentRecord.method != oldRecord.method) {
      result.push({ title: 'Method', content: diffText(oldRecord.method, currentRecord.method) });
    }
    if (currentRecord.catid != oldRecord.catid) {
      result.push({ title: '分类 id', content: diffText(oldRecord.catid, currentRecord.catid) });
    }
    if (currentRecord.status != oldRecord.status) {
      result.push({
        title: '接口状态',
        content: diffText(
          valueMaps[String(oldRecord.status)],
          valueMaps[String(currentRecord.status)]
        )
      });
    }
    if (currentRecord.tag !== oldRecord.tag) {
      result.push({ title: '接口tag', content: diffText(oldRecord.tag, currentRecord.tag) });
    }

    result.push({
      title: 'Request Path Params',
      content: diffArray(
        oldRecord.req_params as DiffRecord[] | undefined,
        currentRecord.req_params as DiffRecord[] | undefined
      )
    });
    result.push({
      title: 'Request Query',
      content: diffArray(
        oldRecord.req_query as DiffRecord[] | undefined,
        currentRecord.req_query as DiffRecord[] | undefined
      )
    });
    result.push({
      title: 'Request Header',
      content: diffArray(
        oldRecord.req_headers as DiffRecord[] | undefined,
        currentRecord.req_headers as DiffRecord[] | undefined
      )
    });

    let oldValue = currentRecord.req_body_type === 'form'
      ? oldRecord.req_body_form
      : oldRecord.req_body_other;
    if (currentRecord.req_body_type !== oldRecord.req_body_type) {
      result.push({
        title: 'Request Type',
        content: diffText(oldRecord.req_body_type, currentRecord.req_body_type)
      });
      oldValue = null;
    }

    if (currentRecord.req_body_type === 'json') {
      result.push({
        title: 'Request Body',
        content: diffJson(oldValue, currentRecord.req_body_other)
      });
    } else if (currentRecord.req_body_type === 'form') {
      result.push({
        title: 'Request Form Body',
        content: diffArray(
          oldValue as DiffRecord[] | undefined,
          currentRecord.req_body_form as DiffRecord[] | undefined
        )
      });
    } else {
      result.push({
        title: 'Request Raw Body',
        content: diffText(oldValue, currentRecord.req_body_other)
      });
    }

    let oldResponseValue = oldRecord.res_body;
    if (currentRecord.res_body_type !== oldRecord.res_body_type) {
      result.push({
        title: 'Response Type',
        content: diffText(oldRecord.res_body_type, currentRecord.res_body_type)
      });
      oldResponseValue = '';
    }

    result.push({
      title: 'Response Body',
      content: currentRecord.res_body_type === 'json'
        ? diffJson(oldResponseValue, currentRecord.res_body)
        : diffText(oldResponseValue, currentRecord.res_body)
    });
  }

  return result.filter(item => item.content);
}
