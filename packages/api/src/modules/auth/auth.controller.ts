import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    await this.authService.processForgotPassword(email);
    // Always return a success response to prevent email enumeration
    return { message: 'Nếu email tồn tại trong hệ thống, mã xác nhận đã được gửi đến bạn.' };
  }

  @Post('verify-code')
  async verifyCode(@Body() body: { email: string; code: string }) {
    if (!body.email || !body.code) {
      throw new HttpException('Vui lòng cung cấp email và mã xác nhận', HttpStatus.BAD_REQUEST);
    }
    const isValid = await this.authService.verifyResetCode(body.email, body.code);
    if (!isValid) {
      throw new HttpException('Mã xác nhận không đúng hoặc đã hết hạn', HttpStatus.BAD_REQUEST);
    }
    return { message: 'Mã xác nhận hợp lệ' };
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    if (!body.email || !body.code || !body.newPassword) {
      throw new HttpException('Vui lòng điền đủ thông tin', HttpStatus.BAD_REQUEST);
    }
    const success = await this.authService.resetPassword(body.email, body.code, body.newPassword);
    if (!success) {
      throw new HttpException('Mã xác nhận không đúng hoặc đã hết hạn', HttpStatus.BAD_REQUEST);
    }
    return { message: 'Đổi mật khẩu thành công' };
  }
}
