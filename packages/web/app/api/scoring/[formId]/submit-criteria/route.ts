import { NextRequest } from 'next/server';
import { proxyToBackend } from '../../../proxy/proxyHelper';

// POST /api/scoring/[formId]/submit-criteria  →  Backend POST /api/scoring/[formId]/submit-criteria
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params;
  const body = await req.text();
  return proxyToBackend(`/api/scoring/${formId}/submit-criteria`, req, {
    method: 'POST',
    body,
  });
}
