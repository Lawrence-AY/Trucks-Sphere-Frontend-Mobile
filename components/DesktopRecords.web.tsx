import React, { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import type { DesktopRecordsProps } from './DesktopRecords';
import { useWebLiveRefresh } from '../hooks/useWebLiveRefresh';
import { ScreenSearchHeader } from './ManagementSearchHeader';

export default function DesktopRecords({ title, description, records, columns, search, onSearch, loading, refreshing, onRefresh, recordHref, createHref, createLabel }: DesktopRecordsProps) {
  const colors = useTheme();
  useWebLiveRefresh(onRefresh);
  const [sort, setSort] = useState({ key: '', descending: false });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const sorted = useMemo(() => {
    const column = columns.find(c => c.key === sort.key);
    if (!column) return records;
    return [...records].sort((a, b) => {
      const av = column.value(a); const bv = column.value(b);
      const result = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sort.descending ? -result : result;
    });
  }, [records, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, (current + 1) * pageSize);
  const button: React.CSSProperties = { padding: '9px 14px', border: `1px solid ${colors.border}`, borderRadius: 6, background: colors.surface, color: colors.text, font: 'inherit', cursor: 'pointer' };
  return <section className="desktop-records" aria-label={title} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 28, color: colors.text, fontFamily: 'system-ui, sans-serif', fontSize: 14, background: colors.background }}>
    <style>{`.desktop-records button:focus-visible,.desktop-records a:focus-visible,.desktop-records input:focus-visible,.desktop-records select:focus-visible{outline:2px solid ${colors.primary};outline-offset:3px}.desktop-records tbody tr:hover{background:${colors.inputBg}}.desktop-records button:disabled{opacity:.45;cursor:default}.desktop-records a:hover{text-decoration:underline!important}`}</style>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 24 }}>
      <div><h1 style={{ fontSize: 28, letterSpacing: '-.7px', margin: '0 0 6px' }}>{title}</h1><p style={{ color: colors.textMuted, margin: 0 }}>{description || `Manage and review your ${title.toLowerCase()}.`}</p></div>
      {createHref && <Link href={createHref as any} style={{ backgroundColor: colors.primary, color: colors.onPrimary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 6, fontWeight: '600', fontSize: 14 }}>{createLabel || `Add ${title.toLowerCase()}`}</Link>}
    </header>
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, background: colors.surface, overflow: 'hidden' }}>
      <ScreenSearchHeader title={title} search={search} onChangeSearch={value => { onSearch(value); setPage(0); }} placeholder={`Search ${title.toLowerCase()}…`} />
      <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, borderBottom: `1px solid ${colors.border}` }}>
        <span role="status" style={{ color: colors.textMuted, flex: 1 }}>{loading ? 'Loading…' : `${records.length.toLocaleString()} records`}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table aria-label={title} aria-busy={loading || refreshing} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
          <thead style={{ background: colors.inputBg }}><tr><th scope="col" style={{ padding: '13px 18px', borderBottom: `1px solid ${colors.border}` }}>No.</th>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort.key !== column.key ? 'none' : sort.descending ? 'descending' : 'ascending'} style={{ padding: '13px 18px', borderBottom: `1px solid ${colors.border}` }}>
            <button onClick={() => { setSort({ key: column.key, descending: sort.key === column.key && !sort.descending }); setPage(0); }} style={{ border: 0, padding: 0, background: 'transparent', color: colors.textSecondary, font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>{column.label}{sort.key === column.key ? sort.descending ? ' ↓' : ' ↑' : ' ↕'}</button>
          </th>)}</tr></thead>
          <tbody>{!loading && visible.map((record, rowIndex) => <tr key={record.id}><td style={{ padding: '15px 18px', borderBottom: `1px solid ${colors.border}`, color: colors.textMuted }}>{current * pageSize + rowIndex + 1}</td>{columns.map((column, index) => <td key={column.key} style={{ padding: '15px 18px', borderBottom: `1px solid ${colors.border}`, color: index === 0 ? colors.text : colors.textSecondary }}>
            {index === 0 && recordHref ? <Link href={recordHref(record) as any} style={{ color: colors.primaryText, fontWeight: '600', fontSize: 14 }}>{column.value(record) || 'View record'}</Link> : column.value(record) || (column.value(record) === 0 ? 0 : '—')}
          </td>)}</tr>)}{(loading || !visible.length) && <tr><td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 64, color: colors.textMuted }}>{loading ? 'Loading records…' : search ? 'No matching records. Try a different search.' : 'No records yet.'}</td></tr>}</tbody>
        </table>
      </div>
      <footer style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', color: colors.textMuted }}>
        <span style={{ flex: 1 }}>{sorted.length ? `${current * pageSize + 1}–${Math.min((current + 1) * pageSize, sorted.length)} of ${sorted.length}` : '0 records'}</span>
        <label>Rows <select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0); }} style={{ ...button, padding: 6 }}>{[25, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label>
        <button style={button} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">Previous</button>
        <span>Page {current + 1} of {pages}</span>
        <button style={button} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">Next</button>
      </footer>
    </div>
  </section>;
}
