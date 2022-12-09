import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventController } from './controller/event.controller';
import { Event } from './entity/event.entity';
import { EventService } from './service/event.service';
import { FileService } from '../file/service/file.service';
import { File } from '../file/entity/file.entity';
import { NodeService } from '../node/service/node.service';
import { Node } from '../node/entity/node.entity';
import { SocketIoClientProxyService } from '../../socket-io-client-proxy/socket-io-client-proxy.service';
import { SocketIoClientProvider } from '../../socket-io-client-proxy/socket-io-client.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    TypeOrmModule.forFeature([File]),
    TypeOrmModule.forFeature([Node]),
  ],
  controllers: [EventController],
  providers: [
    EventService,
    SocketIoClientProxyService,
    FileService,
    NodeService,
    SocketIoClientProvider,
  ],
  exports: [EventService],
})
export class EventModule {}
