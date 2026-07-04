import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export * from '@prisma/client'; 

// NẾU TRONG FILE INDEX.D.TS NÓ TÊN LÀ scoring_sheets_status, HÃY DÙNG DÒNG NÀY:
export { scoring_sheets_status as WorkflowStatus } from '@prisma/client';

// CÒN NẾU NÓ TÊN LÀ WorkflowStatus, THÌ CHỈ CẦN DÙNG DÒNG NÀY:
// export { WorkflowStatus } from './generated/client';