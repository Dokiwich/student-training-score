import React from 'react';

export interface ColumnDef<T> {
  header: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  title: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
  filters?: React.ReactNode;
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  footer?: React.ReactNode;
  onRowClick?: (item: T, rowIndex: number) => void;
  rowTitle?: (item: T, rowIndex: number) => string;
  rowStyle?: (item: T, rowIndex: number) => React.CSSProperties;
}

export function DataTable<T>({
  title,
  subtitle,
  headerActions,
  filters,
  columns,
  data,
  loading = false,
  emptyMessage = 'Không có dữ liệu',
  footer,
  onRowClick,
  rowTitle,
  rowStyle,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang tải...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        className="dashboard-card-header"
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <h2 className="dashboard-card-title">{title}</h2>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {subtitle}
            </p>
          )}
        </div>
        {headerActions && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {headerActions}
          </div>
        )}
      </div>

      {/* Filters */}
      {filters && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {filters}
        </div>
      )}

      {/* Table */}
      <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="dashboard-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    style={{
                      width: col.width,
                      textAlign: col.align || 'left',
                    }}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    style={{
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      padding: 32,
                    }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((item, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(item, rowIndex)}
                    title={rowTitle?.(item, rowIndex)}
                    style={{
                      ...(onRowClick ? { cursor: 'pointer' } : {}),
                      ...rowStyle?.(item, rowIndex),
                    }}
                    onMouseOver={(e) => {
                      if (onRowClick) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseOut={(e) => {
                      if (onRowClick) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {columns.map((col, colIndex) => (
                      <td
                        key={colIndex}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {col.render(item, rowIndex)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {footer && <tfoot>{footer}</tfoot>}
          </table>
        </div>
      </div>
    </div>
  );
}
