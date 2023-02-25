import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventService } from '../event/service/event.service';
import { CertificateController } from './controller/certificate.controller';
import { Certificate } from './entity/certificate.entity';
import { Event } from '../event/entity/event.entity';
import { Node } from '../node/entity/node.entity';
import { CertificateService } from './service/certificate.service';
import { NodeService } from '../node/service/node.service';
import { File } from '../file/entity/file.entity';
import { FileService } from '../file/service/file.service';
import { EventGateway } from '../event/event.gateway';
import { SocketIoClientProxyService } from 'src/socket-io-client-proxy/socket-io-client-proxy.service';
import { SocketIoClientProvider } from 'src/socket-io-client-proxy/socket-io-client.provider';
import { HistoricalEvent } from '../historical-event/entity/historical-event.entity';
import { HistoricalEventService } from '../historical-event/service/historical-event.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate]),
    TypeOrmModule.forFeature([HistoricalEvent]),
    TypeOrmModule.forFeature([Event]),
    TypeOrmModule.forFeature([Node]),
    TypeOrmModule.forFeature([File]),
    HttpModule,
  ],
  controllers: [CertificateController],
  providers: [
    CertificateService,
    HistoricalEventService,
    EventService,
    NodeService,
    FileService,
    SocketIoClientProxyService,
    SocketIoClientProvider,
  ],
  exports: [CertificateService],
})
export class CertificateModule {}
