'use client';

/**
 * AdminDataTable — the CRUD pages' table. Kept as a thin adapter over the desk kit's
 * DataTable so existing call sites (sins, good deeds, sources, tags, sync, linking)
 * share the same density, states and type without rewriting their column defs.
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { DataTable } from './kit/DataTable';

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

interface AdminDataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  className?: string;
  rowKey: (row: T) => string;
}

export function AdminDataTable<T>({
  columns,
  data,
  isLoading = false,
  isError = false,
  onRetry,
  emptyMessage,
  className,
  rowKey,
}: AdminDataTableProps<T>) {
  const t = useTranslations('admin.table');
  const tError = useTranslations('errorState');
  return (
    <DataTable
      className={className}
      columns={columns.map((column) => ({ id: column.key, header: column.header, cell: column.cell, className: column.className }))}
      rows={data}
      rowKey={rowKey}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      skeletonRows={6}
      labels={{
        expand: t('expand'),
        collapse: t('collapse'),
        empty: emptyMessage ?? tError('default'),
        error: tError('default'),
        retry: t('retry'),
      }}
    />
  );
}
