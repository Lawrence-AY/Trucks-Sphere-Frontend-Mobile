/** Read every server page before publishing a collection; never return a partial success. */
export async function allPages<T>(fetchPage: (page: number) => Promise<any>): Promise<T[]> {
  const items: T[] = [];
  let pageSize = 0;
  for (let page = 1; ; page++) {
    const response = await fetchPage(page);
    const rows = Array.isArray(response) ? response : response?.data || response?.items || [];
    if (!Array.isArray(rows)) throw new Error('Invalid collection response');
    if (page === 1) pageSize = rows.length;
    items.push(...rows);
    const totalPages = Number(response?.totalPages || (response?.total != null ? Math.ceil(Number(response.total) / Math.max(pageSize, 1)) : 1));
    if (Array.isArray(response) || page >= totalPages || !rows.length) break;
    if (page >= 10000) throw new Error('Collection pagination limit exceeded');
  }
  return items;
}
