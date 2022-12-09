import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileService } from '../../file/service/file.service';
import { EventService } from '../service/event.service';
import { NodeService } from 'src/modules/node/service/node.service';
import { SocketEvents, SocketStatus, STATUS } from 'src/constants';
import { IEventResult, IGetBySendNodeId, IInsertResult } from '../interface';
import { SocketIoClientProxyService } from 'src/socket-io-client-proxy/socket-io-client-proxy.service';
import { FileUploadDto } from '../dto/fileUpload.dto';

@ApiTags('event')
@Controller('event')
export class EventController {
  constructor(
    private eventService: EventService,
    private fileService: FileService,
    private nodeService: NodeService,
    private readonly socketIoClientProxyService: SocketIoClientProxyService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('fileUpload'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: FileUploadDto,
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() post: { sendNode: string },
    @Res() res: Response,
  ) {
    const receiveNodeId = process.env.NODE_ID;
    const sendNode = post.sendNode;
    const nodeResult = await this.nodeService.findOne(sendNode);
    const sendNodeId = nodeResult.id;
    let tempId: string;

    const name =
      file?.originalname.substring(0, file.originalname.lastIndexOf('.')) || '';

    const findFileId: string = await this.fileService.findByFileName(name);

    const optionEvent = <IGetBySendNodeId>{
      sendNodeId,
      receiveNodeId,
    };
    this.eventService
      .upload(file)
      .then(async () => {
        if (!findFileId) {
          const createdFile: IInsertResult = await this.fileService.create(
            file,
          );
          const insertedFileId: string = createdFile.raw[0].id;
          const createdEvent: IInsertResult = await this.eventService.create({
            ...optionEvent,
            status: STATUS.PENDING,
            fileId: insertedFileId,
          });

          const insertedEventId: string = createdEvent.raw[0].id;

          this.socketIoClientProxyService.emit(SocketEvents.NODE_INIT, {
            id: insertedEventId,
            receiveNodeId,
            sendNodeId,
            status: SocketStatus.PENDING,
          });

          return { id: insertedEventId, fileId: insertedFileId };
        } else {
          const createdEvent: IInsertResult = await this.eventService.create({
            ...optionEvent,
            status: STATUS.PENDING,
            fileId: findFileId,
          });
          const insertedEventId: string = createdEvent.raw[0].id;

          this.socketIoClientProxyService.emit(SocketEvents.NODE_INIT, {
            id: insertedEventId,
            receiveNodeId,
            sendNodeId,
            status: SocketStatus.PENDING,
          });
          return { id: insertedEventId, fileId: findFileId };
        }
      })
      .then(async ({ id, fileId }) => {
        const ds: IEventResult[] = await this.eventService.getByFileId(fileId);
        //update event first item
        if (ds.length === 1) {
          await this.eventService.update(ds[0].event_id, STATUS.SUCCESS);
          tempId = ds[0].event_id;
          setTimeout(() => {
            this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
              id,
              receiveNodeId,
              sendNodeId,
              status: SocketStatus.SUCCESS,
            });
          }, 2000);
        } else if (ds.length > 1) {
          //if multi event , only update new event
          const index = ds.length - 1;
          tempId = ds[index].event_id;
          await this.eventService.update(ds[index].event_id, STATUS.FAIL);
          throw Error(ds[index].event_id);
        } else {
          return;
        }
        res.send({ status: true, message: '' });
      })
      .catch(async (data: { message: string }) => {
        if (!findFileId) {
          const rs: IInsertResult = await this.fileService.create({
            ...file,
            originalname: 'undefined',
          });

          await this.eventService.create({
            ...optionEvent,
            status: STATUS.FAIL,
            fileId: rs.raw[0].id,
          });
        }
        setTimeout(() => {
          const id = data.message;

          this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
            id,
            receiveNodeId,
            sendNodeId,
            status: SocketStatus.FAIL,
          });
        }, 2000);
        res.send({ status: false, message: data.message });
      })
      .finally(() => {
        setTimeout(() => {
          this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
            id: tempId,
            receiveNodeId,
            sendNodeId,
            status: SocketStatus.DONE,
          });
        }, 4000);
      });
  }
}
