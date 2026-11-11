/**
 * صحبة reports for the owner (round 8, B5). Backend: GET /admin/circle-reports, PATCH /admin/circle-reports/:id.
 * The list answer carries `counts` and `nextBefore` beside `data`, so the raw envelope is read here.
 */
import { apiClient, apiPatch } from '@/lib/api-client';
import type { CircleReportsPage, CircleReportStatusFilter } from '@/lib/types/admin';

export async function getCircleReports(query: { status: CircleReportStatusFilter; before?: string; limit?: number }): Promise<CircleReportsPage> {
  const response = await apiClient.get<CircleReportsPage>('/admin/circle-reports', { params: query, skipLang: true } as object);
  return response.data;
}

export async function setCircleReportStatus(id: string, status: CircleReportStatusFilter): Promise<void> {
  await apiPatch(`/admin/circle-reports/${id}`, { status });
}
