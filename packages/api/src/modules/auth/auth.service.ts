import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@student-score/database';
import * as bcrypt from 'bcrypt';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Setup Nodemailer transporter with Outlook configuration
    // If env variables are not set, it will fail gracefully or we can mock it
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });
  }

  /** Generates a 6-digit random code */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async processForgotPassword(email: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      this.logger.warn(`Password reset requested for unknown email: ${email}`);
      return false; // Silently return to prevent email enumeration
    }

    const otp = this.generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Update user record with OTP using type assertion due to pending Prisma generation
    await prisma.users.update({
      where: { id: user.id },
      data: {
        reset_token: otp,
        reset_token_expires: expiresAt,
      } as any,
    });

    this.logger.log(`Generated OTP for ${email}: ${otp} (Valid for 15m)`);

    // Try to send email, catch errors if SMTP is not configured
    try {
      if (process.env.SMTP_USER) {
        await this.transporter.sendMail({
          from: `"Hệ thống ĐRL" <${process.env.SMTP_USER}>`,
          to: email,
          subject: 'Mã xác nhận lấy lại mật khẩu',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
              <h2 style="color: #0f4c81; text-align: center;">Cổng Sinh Viên</h2>
              <p>Chào <strong>${user.full_name}</strong>,</p>
              <p>Bạn vừa yêu cầu lấy lại mật khẩu. Vui lòng sử dụng mã xác nhận gồm 6 chữ số dưới đây để đổi mật khẩu mới:</p>
              <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
                ${otp}
              </div>
              <p style="color: #666; font-size: 13px;"><em>Mã xác nhận này sẽ hết hạn sau 15 phút. Không chia sẻ mã này cho bất kỳ ai.</em></p>
            </div>
          `,
        });
        this.logger.log(`Email sent successfully to ${email}`);
      } else {
        this.logger.warn('SMTP_USER not configured. OTP email was not sent. Check console for OTP.');
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}: ${error.message}`);
    }

    return true;
  }

  async verifyResetCode(email: string, code: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, reset_token: true, reset_token_expires: true } as any,
    });

    if (!user) return false;

    // Use type assertion since reset_token might not be in the generated types yet
    const dbUser = user as any;

    if (!dbUser.reset_token || dbUser.reset_token !== code) {
      return false;
    }

    if (!dbUser.reset_token_expires || new Date() > new Date(dbUser.reset_token_expires)) {
      return false; // Expired
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
