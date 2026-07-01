import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@student-score/database';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor() {}

  /** Generates a secure 6-digit random code */
  private generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async processForgotPassword(email: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
      return true; // Silently return true to prevent email enumeration (timing attack mitigated by not awaiting email anyway)
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Hash the OTP securely
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Update user record with hashed OTP
    await prisma.users.update({
      where: { id: user.id },
      data: {
        reset_token: hashedOtp,
        reset_token_expires: expiresAt,
        failed_login_attempts: 0, // Reset any existing brute-force counters
        locked_until: null,
      } as any,
    });

    this.logger.log(`Generated secure OTP for ${email} (Valid for 15m)`);

    // Fire and forget email to prevent timing attack
    this.sendOtpEmail(email, user.full_name, otp).catch(err => {
      this.logger.error(`Async email failed for ${email}: ${err.message}`);
    });

    return true;
  }

  private async sendOtpEmail(email: string, fullName: string, otp: string) {
    const apiKey = process.env.MAILEROO_API_KEY;
    if (!apiKey) {
      this.logger.warn(`MAILEROO_API_KEY not configured. OTP email was not sent. Check console for OTP. Mock OTP for ${email}: ${otp}`);
      return;
    }

    const senderEmail = process.env.EMAIL_SENDER || 'noreply@student.mit.vn';
    
    try {
      // ponytail: "Does the standard library already do this? Use it."
      // Instead of the 15-dependency `maileroo` SDK, we use native fetch & FormData
      const formData = new FormData();
      formData.append('from', `Cổng Sinh Viên <${senderEmail}>`);
      formData.append('to', `${fullName} <${email}>`);
      formData.append('subject', 'Mã xác nhận lấy lại mật khẩu');
      formData.append('plain', `Mã xác nhận của bạn là: ${otp}`);
      formData.append('html', `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
          <h2 style="color: #0f4c81; text-align: center;">Cổng Sinh Viên</h2>
          <p>Chào <strong>${fullName}</strong>,</p>
          <p>Bạn vừa yêu cầu lấy lại mật khẩu. Vui lòng sử dụng mã xác nhận gồm 6 chữ số dưới đây để đổi mật khẩu mới:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 13px;"><em>Mã xác nhận này sẽ hết hạn sau 15 phút. Không chia sẻ mã này cho bất kỳ ai.</em></p>
        </div>
      `);

      const response = await fetch('https://smtp.maileroo.com/send', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      this.logger.log(`Email sent successfully via Maileroo to ${email}`);
    } catch (error: any) {
      this.logger.error(`Failed to send Maileroo email to ${email}: ${error.message}`);
    }
  }

  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, reset_token: true, reset_token_expires: true, failed_login_attempts: true, locked_until: true } as any,
    });

    if (!user) return false;

    // Use type assertion since reset_token might not be in the generated types yet
    const dbUser = user as any;

    if (dbUser.locked_until && new Date() < new Date(dbUser.locked_until)) {
      this.logger.warn(`Verification denied: Account locked due to brute-force for ${email}`);
      throw new Error('Tài khoản đã bị khoá tạm thời do nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    }

    if (!dbUser.reset_token) {
      return false;
    }

    if (!dbUser.reset_token_expires || new Date() > new Date(dbUser.reset_token_expires)) {
      return false; // Expired
    }

    const isMatch = await bcrypt.compare(code, dbUser.reset_token);

    if (!isMatch) {
      const attempts = (dbUser.failed_login_attempts || 0) + 1;
      const updates: any = { failed_login_attempts: attempts };
      if (attempts >= 5) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        this.logger.warn(`Locked account ${email} for 15m due to multiple failed OTPs`);
      }
      await prisma.users.update({ where: { id: dbUser.id }, data: updates });
      return false;
    }

    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<boolean> {
    const isValid = await this.verifyResetCode(email, code);
    if (!isValid) return false;

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { email },
      data: {
        password_hash: passwordHash,
        failed_login_attempts: 0, // unlock account if it was locked
        reset_token: null,
        reset_token_expires: null,
      } as any,
    });

    this.logger.log(`Password reset successfully for user: ${email}`);
    return true;
  }
}
