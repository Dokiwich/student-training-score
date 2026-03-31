import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // PHỤC HỒI TIỀN TỐ API Ở ĐÂY:
  // Lệnh này tự động nhét chữ '/api' lên trước tất cả các Controller
  app.setGlobalPrefix('api');

  const allowedPrefixes = ['http://localhost', 'http://127.0.0.1', 'http://192.168.'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedPrefixes.some(prefix => origin.startsWith(prefix))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(3000);
  console.log(`🚀 Máy chủ Backend đang chạy tại: http://localhost:3000`);
}
bootstrap();