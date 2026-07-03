import { NextRequest } from 'next/server';
import { proxyToBackend } from '../../../proxy/proxyHelper';

export const dynamic = 'force-dynamic';
// GET /api/scoring/[formId]/scores?studentId=xxx  →  Backend GET /api/scoring/[formId]/scores?studentId=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const studentId = req.nextUrl.searchParams.get('studentId') || '';
  return proxyToBackend(`/api/scoring/${formId}/scores?studentId=${studentId}`, req);
}
