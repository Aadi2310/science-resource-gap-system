import type { ReactNode } from 'react';
import type { Priority, RequirementStatus } from '../types';

export function PageTitle({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-title"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function StateBadge({ value }: { value: Priority | RequirementStatus | 'VERIFIED' | 'PENDING' | 'REJECTED' | 'Adequate' | 'Gap' | 'DRAFT' | 'SUBMITTED' }) {
  const priority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(value);
  const tone = value === 'CRITICAL' || value === 'DISPUTED' || value === 'REJECTED' || value === 'NOT_FEASIBLE' || value === 'Gap' ? 'red'
    : value === 'HIGH' || value === 'PENDING' || value === 'UNDER_REVIEW' || value === 'PARTIALLY_COMPLETED' || value === 'SUBMITTED' ? 'amber'
    : value === 'VERIFIED' || value === 'CLOSED' || value === 'COMPLETED' || value === 'Adequate' ? 'green' : 'neutral';
  const label = String(value).replaceAll('_', ' ');
  return <span className={`badge badge-${tone}`} aria-label={`${priority ? 'Priority' : 'Status'}: ${label}`}>{label}</span>;
}

type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode; className?: string };

export function DataTable<T>({ columns, rows, rowKey, emptyText = 'No records found for the selected filters.' }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyText?: string;
}) {
  return <div className="table-scroll">
    <table>
      <thead><tr>{columns.map((column) => <th className={column.className} key={column.key} scope="col">{column.label}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td className="empty-cell" colSpan={columns.length}>{emptyText}</td></tr>
          : rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => {
            const value = column.render ? column.render(row) : String((row as unknown as Record<string, unknown>)[column.key] ?? 'Not provided');
            return <td className={column.className} key={column.key}>{value}</td>;
          })}</tr>)}
      </tbody>
    </table>
  </div>;
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <div className="pagination" aria-label="Table pagination"><span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span><div><button className="button button-secondary button-small" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button><span className="page-number">Page {page} of {pages}</span><button className="button button-secondary button-small" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></div></div>;
}

export function FormField({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return <div className={`field${error ? ' field-invalid' : ''}`}><label htmlFor={htmlFor}>{label}</label>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error" role="alert">{error}</small>}</div>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'error' | 'success' }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <section className="stat-panel"><h2>{label}</h2><p className="stat-value">{value}</p>{note && <p className="stat-note">{note}</p>}</section>;
}

export function formatDate(value?: string) {
  if (!value) return 'Not provided';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}
