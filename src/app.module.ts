import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './config/database/typeorm-config.service';
import { EventModule } from './modules/event/event.module';
import { NodeModule } from './modules/node/node.module';
import { CertificateModule } from './modules/certificate/certificate.module';
import { HistoricalEventModule } from './modules/historical-event/historical-event.module';
import { EventGatewayModule } from './modules/event-gateway/event-gateway.module';
import { AppGateway } from './app.gateway';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    EventGatewayModule,
    ScheduleModule.forRoot(),
    NodeModule,
    EventModule,
    CertificateModule,
    HistoricalEventModule,
  ],
  providers: [AppGateway],
})
export class AppModule {}
