import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // PHỤC HỒI TIỀN TỐ API Ở ĐÂY:
  // Lệnh này tự động nhét chữ '/api' lên trước tất cả các Controller
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  await app.listen(3000);
  console.log(`🚀 Máy chủ Backend đang chạy tại: http://localhost:3000`);
}
bootstrap();