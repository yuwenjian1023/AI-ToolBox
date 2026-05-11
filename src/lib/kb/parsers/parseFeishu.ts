/**
 * 飞书多维表格解析
 * 需要配置环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET
 */

async function getAccessToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) throw new Error('飞书配置缺失：请设置 FEISHU_APP_ID 和 FEISHU_APP_SECRET');

  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取飞书 token 失败: ${data.msg}`);
  return data.tenant_access_token;
}

function parseBitableUrl(url: string): { appToken: string; tableId: string; wikiToken: string } {
  const tableMatch = url.match(/[?&]table=([A-Za-z0-9]+)/);
  const tableId = tableMatch ? tableMatch[1] : '';

  // Format 1: /base/{appToken}
  const baseMatch = url.match(/\/base\/([A-Za-z0-9]+)/);
  if (baseMatch) {
    return { appToken: baseMatch[1], tableId, wikiToken: '' };
  }

  // Format 2: /wiki/{wikiToken}?table=tblxxx (wiki-embedded bitable)
  const wikiMatch = url.match(/\/wiki\/([A-Za-z0-9]+)/);
  if (wikiMatch) {
    return { appToken: '', tableId, wikiToken: wikiMatch[1] };
  }

  throw new Error('无法解析飞书链接，支持 /base/xxx 或 /wiki/xxx?table=tblxxx 格式');
}

async function resolveWikiToAppToken(wikiToken: string, accessToken: string): Promise<string> {
  const res = await fetch(
    `https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${wikiToken}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`获取知识库节点失败: ${data.msg}`);
  const objToken = data.data?.node?.obj_token;
  if (!objToken) throw new Error('未能从知识库节点获取多维表格 token');
  return objToken;
}

export async function parseFeishu(url: string): Promise<{ text: string; rows: string[] }> {
  const token = await getAccessToken();
  const parsed = parseBitableUrl(url);

  // Resolve wiki token to actual bitable app token
  let appToken = parsed.appToken;
  if (!appToken && parsed.wikiToken) {
    appToken = await resolveWikiToAppToken(parsed.wikiToken, token);
  }
  if (!appToken) throw new Error('未能获取多维表格 app token');

  const tableId = parsed.tableId;

  // If no tableId, get first table
  let actualTableId = tableId;
  if (!actualTableId) {
    const tablesRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const tablesData = await tablesRes.json();
    if (tablesData.data?.items?.length > 0) {
      actualTableId = tablesData.data.items[0].table_id;
    } else {
      throw new Error('未找到表格');
    }
  }

  // Get fields
  const fieldsRes = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${actualTableId}/fields`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const fieldsData = await fieldsRes.json();
  const fields: Array<{ field_id: string; field_name: string }> = fieldsData.data?.items || [];
  const fieldMap = new Map(fields.map((f) => [f.field_id, f.field_name]));

  // Get records (paginated)
  const rows: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: '100' });
    if (pageToken) params.set('page_token', pageToken);

    const recordsRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${actualTableId}/records?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const recordsData = await recordsRes.json();

    for (const record of recordsData.data?.items || []) {
      const parts: string[] = [];
      for (const [fieldId, value] of Object.entries(record.fields || {})) {
        const name = fieldMap.get(fieldId) || fieldId;
        const text = extractFieldText(value);
        if (text) parts.push(`${name}: ${text}`);
      }
      if (parts.length > 0) rows.push(parts.join(' | '));
    }

    pageToken = recordsData.data?.has_more ? recordsData.data.page_token : undefined;
  } while (pageToken);

  if (rows.length === 0) throw new Error('飞书表格数据为空');

  return { text: rows.join('\n'), rows };
}

function extractFieldText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'object' && v !== null && 'text' in v) return (v as { text: string }).text;
      if (typeof v === 'object' && v !== null && 'name' in v) return (v as { name: string }).name;
      return String(v);
    }).join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    if ('text' in value) return (value as { text: string }).text;
    if ('name' in value) return (value as { name: string }).name;
  }
  return String(value);
}
