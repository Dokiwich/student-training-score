import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';

export interface ColumnDef<T> {
  header: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  className?: string;
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

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="border-b border-border bg-surface-muted">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-3 shrink-0">
              {headerActions}
            </div>
          )}
        </div>

        {/* Filters */}
        {filters && (
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-border">
            {filters}
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <CardContent className="p-0">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4"></div>
            <p className="text-sm font-medium">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[65vh] relative">
            <table className="w-full text-left border-collapse min-w-1000px">
              <thead className="sticky top-0 z-10">
                <tr className="bg-surface-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className="px-6 py-4 bg-surface-muted border-b border-border"
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
              <tbody className="divide-y divide-border">
                {data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-12 text-center text-muted-foreground text-sm font-medium"
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
                      className={`transition-colors border-b border-border last:border-b-0 ${onRowClick ? 'cursor-pointer hover:bg-surface-elevated group' : 'hover:bg-surface-muted'}`}
                      style={{
                        ...rowStyle?.(item, rowIndex),
                      }}
                    >
                      {columns.map((col, colIndex) => (
                        <td
                          key={colIndex}
                          className={`px-6 py-4 ${col.className || 'whitespace-nowrap'}`}
                          style={{ textAlign: col.align || 'left' }}
                        >
                          {col.render(item, rowIndex)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {footer && <tfoot className="bg-surface-muted border-t border-border">{footer}</tfoot>}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
