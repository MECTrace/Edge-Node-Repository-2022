import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './config/database/typeorm-config.service';
import { EventModule } from './modules/event/event.module';
import { NodeModule } from './modules/node/node.module';
import { SocketIoClientProvider } from './socket-io-client-proxy/socket-io-client.provider';
import { SocketIoClientProxyService } from './socket-io-client-proxy/socket-io-client-proxy.service';
import { CertificateModule } from './modules/certificate/certificate.module';
import { HistoricalEventModule } from './modules/historical-event/historical-event.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    ScheduleModule.forRoot(),
    NodeModule,
    EventModule,
    CertificateModule,
    HistoricalEventModule,
  ],
  providers: [SocketIoClientProvider, SocketIoClientProxyService],
})
export class AppModule {}
