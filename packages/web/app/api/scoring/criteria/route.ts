import { NextRequest } from 'next/server';
import { proxyToBackend } from '../../proxy/proxyHelper';

// GET /api/scoring/criteria  →  Backend GET /api/scoring/criteria
export async function GET(req: NextRequest) {
  return proxyToBackend('/api/scoring/criteria', req);
}
