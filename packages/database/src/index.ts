import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export { prisma };
export * from '@prisma/client'; 

// NẾU TRONG FILE INDEX.D.TS NÓ TÊN LÀ scoring_sheets_status, HÃY DÙNG DÒNG NÀY:
export { scoring_sheets_status as WorkflowStatus } from '@prisma/client';

// CÒN NẾU NÓ TÊN LÀ WorkflowStatus, THÌ CHỈ CẦN DÙNG DÒNG NÀY:
// export { WorkflowStatus } from './generated/client';