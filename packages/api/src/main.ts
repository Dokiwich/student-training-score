import * as fs from 'fs';
import * as path from 'path';
const envPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (key !== 'PORT' && !process.env[key]) process.env[key] = val;
    }
  });
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

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

  // PHỤC HỒI TIỀN TỐ API Ở ĐÂY:
  // Lệnh này tự động nhét chữ '/api' lên trước tất cả các Controller
  app.setGlobalPrefix('api');

  // --- Security Middleware ---
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit').default || require('express-rate-limit');
  const xss = require('xss-clean');
  const hpp = require('hpp');

  app.use(helmet());
  app.use(xss());
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
  await app.listen(port);
  console.log(`🚀 Máy chủ Backend đang chạy tại: http://localhost:${port}`);
}
bootstrap();