import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { prisma } from '@student-score/database';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Using type assertion to bypass strict typing if id is not on user
    const userId = (session?.user as any)?.id;
    
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await prisma.users.update({
      where: { id: userId },
      data: {
        session_version: { increment: 1 }
      }
    });
    
    return NextResponse.json({ message: "Logged out from all devices successfully." });
  } catch (error) {
    console.error("Logout all devices error:", error);
    return NextResponse.json({ message: "An error occurred while logging out from all devices." }, { status: 500 });
  }
}
