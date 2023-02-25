import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { WEB_SOCKET_GATEWAY } from './constants';
import { SocketIoClientProvider } from './socket-io-client-proxy/socket-io-client.provider';
import { SocketIoClientStrategy } from './socket-io-client-proxy/socket-io-client.strategy';
import { GlobalExceptionFilter } from './all-exceptions.filter';

const httpCert = () => {
  const keyPath = 'cert/edge-key.pem';
  const certPath = 'cert/edge-cert.pem';
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
  return {
    key: undefined,
    cert: undefined,
  };
};

async function bootstrap() {
  let httpsOptions: { key: Buffer; cert: Buffer };
  const { key, cert } = httpCert();
  if (!!key && !!cert) {
    httpsOptions = {
      key,
      cert,
    };
  }

  const rootCA = 'cert/ca-cert.pem';
  if (fs.existsSync(rootCA)) {
    process.env.NODE_EXTRA_CA_CERTS = fs.readFileSync(rootCA).toString();
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions,
  });

  const socketIoClientProvider = app.get<SocketIoClientProvider>(
    SocketIoClientProvider,
  );

  app.connectMicroservice<MicroserviceOptions>({
    strategy: new SocketIoClientStrategy(socketIoClientProvider.getSocket()),
  });

  app.enableCors(WEB_SOCKET_GATEWAY);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  const options = new DocumentBuilder()
    .setTitle('Penta Security')
    .setDescription('Penta Security Swagger API Document')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/docs', app, document);
  await app.startAllMicroservices();
  await app.listen(Number(process.env.APP_PORT) || 3000);
}
void bootstrap();
