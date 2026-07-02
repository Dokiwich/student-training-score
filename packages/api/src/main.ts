import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Input Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // PHỤC HỒI TIỀN TỐ API Ở ĐÂY:
  // Lệnh này tự động nhét chữ '/api' lên trước tất cả các Controller
  app.setGlobalPrefix('api');

  // --- Security Middleware ---
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit').default || require('express-rate-limit');
  const hpp = require('hpp');

  app.use(helmet());
  // Removed xss-clean due to TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
  app.use(hpp());
  
  // Rate limiting (100 requests per 15 mins)
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.'
  }));
  // ---------------------------

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

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Máy chủ Backend đang chạy tại: http://localhost:${port}`);
}
bootstrap();