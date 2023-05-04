import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateController } from './controller/certificate.controller';
import { Certificate } from './entity/certificate.entity';
import { Event } from '../event/entity/event.entity';
import { Node } from '../node/entity/node.entity';
import { CertificateService } from './service/certificate.service';
import { NodeService } from '../node/service/node.service';
import { File } from '../file/entity/file.entity';
import { HistoricalEvent } from '../historical-event/entity/historical-event.entity';
import { AzureService } from '../azure-service/service/azure-service.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificate]),
    TypeOrmModule.forFeature([Node]),
    HttpModule,
  ],
  controllers: [CertificateController],
  providers: [CertificateService, NodeService, AzureService],
  exports: [CertificateService],
})
export class CertificateModule {}
