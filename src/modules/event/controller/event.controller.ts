import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SocketEvents, SocketStatus, STATUS, ROOT_CA } from 'src/constants';
import { NodeService } from 'src/modules/node/service/node.service';
import { FileService } from '../../file/service/file.service';
import { FileUploadDto } from '../dto/fileUpload.dto';
import { IEventResult, IGetBySendNodeId, IInsertResult } from '../interface';
import { EventService } from '../service/event.service';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { FileUploadFromNodeDto } from '../dto/fileUploadFromNode.dto';
import { lastValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as https from 'https';

@ApiTags('event')
@Controller('event')
export class EventController {
  constructor(
    private eventService: EventService,
    private fileService: FileService,
    private nodeService: NodeService,
    private httpService: HttpService,
  ) // private readonly socketIoClientProxyService: SocketIoClientProxyService,
  {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('fileUpload', {
      storage: diskStorage({
        // Destination storage path details
        destination: (req: any, file: any, cb: any) => {
          const uploadPath = process.env.UPLOAD_LOCATION;
          // Create folder if doesn't exist
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath);
          }
          cb(null, uploadPath);
        },
        // File modification details
        filename: (req: any, file: any, cb: any) => {
          // Calling the callback passing the original name
          cb(null, file.originalname);
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: FileUploadDto,
  })
  upload(@UploadedFile() file: Express.Multer.File) {
    console.log(file);
  }

  @Post('uploadFromNode')
  @UseInterceptors(FileInterceptor('fileUpload'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: FileUploadFromNodeDto,
  })
  async uploadFromNode(
    @UploadedFile() file: Express.Multer.File,
    @Body() post: { sendNode: string },
  ) {
    // find limit to accept send file, send request to cloud central
    const policyURL =
      process.env.CLOUD_URL +
      `/api/policyManager/getPolicyByNodeId/${process.env.NODE_ID}`;

    const httpsAgent = new https.Agent({
      ca: fs.readFileSync(ROOT_CA).toString(),
    });

    // chua update status vm
    let policy: any;
    try {
      const { data } = await lastValueFrom(
        this.httpService.get(policyURL, {
          httpsAgent,
        }),
      );
      policy = data;
    } catch (err) {
      const { data } = await lastValueFrom(
        this.httpService.get(policyURL, {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        }),
      );
      policy = data;
    }

    const nodeName = policy[0].nodeName as string;
    const cpuOverPercent = +policy[0].cpuOverPercent;
    const cpuLessThanPercent = +policy[0].cpuLessThanPercent;
    const numberResendNode = +policy[0].numberResendNode;
    const policyName = policy[0].policyName;

    // send file
    const postBody = {
      sendNode: post.sendNode,
      cpu_limit: cpuOverPercent,
      policyName: policyName,
    };
    const { status, eventId } = await this.eventService.uploadFromNode(
      file,
      postBody,
    );

    // if send fail, we redirect to send others
    if (!status) {
      // await timeout(3000);

      const availableNodeURL =
        process.env.CLOUD_URL +
        `/api/node/getAvailableNode/${process.env.NODE_ID}/${cpuLessThanPercent}`;

      let availableNodeData: any;
      try {
        const { data } = await lastValueFrom(
          this.httpService.get(availableNodeURL, {
            httpsAgent,
          }),
        );
        availableNodeData = data;
      } catch (err) {
        const { data } = await lastValueFrom(
          this.httpService.get(availableNodeURL, {
            httpsAgent: new https.Agent({
              rejectUnauthorized: false,
            }),
          }),
        );
        availableNodeData = data;
      }

      const receiveNode = availableNodeData['availableNode'];

      await this.eventService.reSend(file, {
        sendNode: nodeName,
        receiveNode: receiveNode,
        numberResendNode: numberResendNode,
      });
    }
    return {
      status: status,
      eventId: eventId,
    };
  }

  @Post('resend')
  @UseInterceptors(FileInterceptor('fileUpload'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: FileUploadFromNodeDto,
  })
  async reSend(
    @UploadedFile() file: Express.Multer.File,
    @Body() post: { sendNode: string },
  ) {
    // find limit to accept send file
    // policy's current node
    const policyURL =
      process.env.CLOUD_URL +
      `/api/policyManager/getPolicyByNodeId/${process.env.NODE_ID}`;

    const httpsAgent = new https.Agent({
      ca: fs.readFileSync(ROOT_CA).toString(),
    });

    let policy: any;
    try {
      const { data } = await lastValueFrom(
        this.httpService.get(policyURL, {
          httpsAgent,
        }),
      );
      policy = data;
    } catch (err) {
      const { data } = await lastValueFrom(
        this.httpService.get(policyURL, {
          httpsAgent: new https.Agent({
            rejectUnauthorized: false,
          }),
        }),
      );
      policy = data;
    }

    // send file
    const postBody = {
      sendNode: post.sendNode,
      cpu_limit: policy[0].cpuOverPercent,
      policyName: policy[0].policyName,
    };
    return this.eventService.uploadFromNode(file, postBody);
  }
}
