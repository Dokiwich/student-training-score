import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

export { prisma };
export * from './generated/client'; 

// NẾU TRONG FILE INDEX.D.TS NÓ TÊN LÀ scoring_sheets_status, HÃY DÙNG DÒNG NÀY:
export { scoring_sheets_status as WorkflowStatus } from './generated/client';

// CÒN NẾU NÓ TÊN LÀ WorkflowStatus, THÌ CHỈ CẦN DÙNG DÒNG NÀY:
// export { WorkflowStatus } from './generated/client';