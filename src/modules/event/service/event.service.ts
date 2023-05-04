import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import { Injectable, UploadedFile, Body, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from '../../file/entity/file.entity';
import { Node } from '../../node/entity/node.entity';
import { Event } from '../entity/event.entity';
import { IEventResult, IInsertResult, IGetBySendNodeId } from '../interface';
import { NodeService } from 'src/modules/node/service/node.service';
import { FileService } from 'src/modules/file/service/file.service';
import { SocketEvents, SocketStatus, STATUS, ROOT_CA } from 'src/constants';
import * as FormData from 'form-data';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as https from 'https';
import { HistoricalEventService } from 'src/modules/historical-event/service/historical-event.service';
import { ClientGateway } from 'src/modules/gateway/gateway-client';

@Injectable()
export class EventService {
  getBlobClient(fileName: string, containerName: string): BlockBlobClient {
    const blobClientService = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION,
    );
    const containerClient = blobClientService.getContainerClient(containerName);

    return containerClient.getBlockBlobClient(fileName);
  }

  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private nodeService: NodeService,
    private fileService: FileService,
    private httpService: HttpService,
    // private readonly socketIoClientProxyService: SocketIoClientProxyService,
    private socketClient: ClientGateway,
    private historicalEventService: HistoricalEventService,
  ) {}

  async upload(prefix: string, file: Express.Multer.File) {
    try {
      const blobClient = this.getBlobClient(
        prefix + file.originalname,
        process.env.AZURE_STORAGE_CONTAINER,
      );
      await blobClient.uploadData(file.buffer, {
        blockSize: 4 * 1024 * 1024, // 4MB block size
        concurrency: 20, // 20 concurrency
      });
    } catch (err) {
      // throw Error(err);
    }
  }

  async uploadFromNode(
    @UploadedFile() file: Express.Multer.File,
    @Body() post: { sendNode: string; cpu_limit: number; policyName: string },
  ) {
    const receiveNodeId = process.env.NODE_ID;
    const sendNode = post.sendNode;
    const cpu_limit = post.cpu_limit;
    const policyName = post.policyName;
    const nodeResult = await this.nodeService.findOne(sendNode);
    const sendNodeId = nodeResult.id;
    let fileId: string;
    let isSuccess = false;

    const optionEvent = <IGetBySendNodeId>{
      sendNodeId,
      receiveNodeId,
      policyName,
    };

    const path =
      `/${process.env.AZURE_STORAGE_CONTAINER}` +
      `/${process.env.VM_NAME}/${file.originalname}`;

    const findFileId: string = await this.fileService.findByPath(path);
    if (!findFileId) {
      const createdFile: IInsertResult = await this.fileService.create(
        `${process.env.VM_NAME}`,
        file,
      );

      fileId = createdFile.raw[0].id;
    } else {
      fileId = findFileId;
    }

    const createdEvent: IInsertResult = await this.create({
      ...optionEvent,
      status: STATUS.PENDING,
      fileId: fileId,
    });
    const totalEvents = (
      await this.getNumberOfFilesUpload(sendNodeId, receiveNodeId)
    ).total;
    const insertedEventId: string = createdEvent.raw[0].id;

    // this.socketIoClientProxyService.emit(SocketEvents.NODE_INIT, {
    //   id: insertedEventId,
    //   receiveNodeId,
    //   sendNodeId,
    //   status: SocketStatus.PENDING,
    // });

    try {
      const infoCurrentNode = await this.nodeService.getCPUCurrentNode();
      const cpu = infoCurrentNode['cpuUsage'];

      if (cpu < cpu_limit) {
        // accept to send file
        const form = new FormData();
        form.append('fileUpload', file.buffer, {
          filename: file.originalname,
        });

        try {
          const url = process.env.NODE_URL + '/api/event/upload';
          await lastValueFrom(
            this.httpService.post(url, form, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
            }),
          );
        } catch {
          // throw error
          console.log('[Error] Cannot send file');
          throw Error();
        }

        // upload to backup
        await this.upload(`${process.env.VM_NAME}/`, file);

        // update event and file table
        await this.fileService.update(findFileId, path);
        await this.update(insertedEventId, STATUS.SUCCESS);
        isSuccess = true;

        await this.historicalEventService.updateOne(
          sendNodeId,
          receiveNodeId,
          insertedEventId,
          totalEvents + 1,
          SocketStatus.SUCCESS,
        );
        setTimeout(() => {
          // this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
          //   id: insertedEventId,
          //   receiveNodeId,
          //   sendNodeId,
          //   status: SocketStatus.SUCCESS,
          // });
        }, 2000);
      } else {
        // throw error
        throw Error(insertedEventId);
      }
    } catch {
      // Cant meet cpu condition
      // upload to backup
      await this.upload(`${process.env.VM_NAME}/`, file);

      // update event and file table
      await this.fileService.update(findFileId, path);
      await this.update(insertedEventId, STATUS.FAIL);

      await this.historicalEventService.updateOne(
        sendNodeId,
        receiveNodeId,
        insertedEventId,
        totalEvents + 1,
        SocketStatus.FAIL,
      );
      setTimeout(() => {
        // this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
        //   id: insertedEventId,
        //   receiveNodeId,
        //   sendNodeId,
        //   status: SocketStatus.FAIL,
        // });
      }, 2000);
    } finally {
      setTimeout(() => {
        // this.socketIoClientProxyService.emit(SocketEvents.NODE_UPDATE, {
        //   id: insertedEventId,
        //   receiveNodeId,
        //   sendNodeId,
        //   status: SocketStatus.DONE,
        // });
      }, 4000);
    }
    return {
      status: isSuccess,
      eventId: insertedEventId,
    };
  }

  async reSend(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    post: {
      sendNode: string;
      receiveNode: any;
      numberResendNode: number;
    },
  ) {
    let count = 0;
    for (const node of post.receiveNode) {
      if (count >= post.numberResendNode) {
        break;
      }

      // begin to send file
      const form = new FormData();
      form.append('fileUpload', file.buffer, {
        filename: file.originalname,
      });
      form.append('sendNode', post.sendNode);

      try {
        const url = node.nodeURL + '/api/event/resend';

        const httpsAgent = new https.Agent({
          ca: fs.readFileSync(ROOT_CA).toString(),
        });

        let isSuccess: any;
        try {
          const { data } = await lastValueFrom(
            this.httpService.post(url, form, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              httpsAgent: httpsAgent,
            }),
          );
          isSuccess = data;
        } catch (err) {
          const { data } = await lastValueFrom(
            this.httpService.post(url, form, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              httpsAgent: new https.Agent({
                rejectUnauthorized: false,
              }),
            }),
          );
          isSuccess = data;
        }

        if (!isSuccess.status) {
          throw Error();
        }
        count += 1;
      } catch {
        // throw error
        console.log('[Error] Cannot resend file');
      }
    }
  }

  async forceUploadCertificates(buffer: Buffer, blobName: string) {
    try {
      const blobClient = this.getBlobClient(
        blobName,
        process.env.AZURE_STORAGE_CERT,
      );
      await blobClient.uploadData(buffer, {
        blockSize: 1024,
        concurrency: 20,
      });
    } catch (err) {
      console.log(err);
    }
  }

  async deleteCertificate(filename: string) {
    const blobClient = this.getBlobClient(
      filename,
      process.env.AZURE_STORAGE_CERT,
    );
    await blobClient.deleteIfExists();
  }

  async pullCertificate(fileName: string) {
    const blobClient = this.getBlobClient(
      fileName,
      process.env.AZURE_STORAGE_CERT,
    );
    await blobClient.downloadToFile(`cert\\${fileName}`);
  }

  async update(id: string, status: string) {
    await this.eventRepository
      .createQueryBuilder()
      .update(Event)
      .set({ status })
      .where({
        id: id,
      })
      .execute();
  }

  async getBySendNodeId(sendNodeId: string, page = 1) {
    const limit = 10;
    const rs = this.eventRepository
      .createQueryBuilder('event')
      .innerJoin(File, 'file', 'event.fileId = file.id ')
      .innerJoin(Node, 'sendNode', 'event.sendNodeId = sendNode.id')
      .innerJoin(Node, 'receiveNode', 'event.receiveNodeId = receiveNode.id')
      .select([
        '"event"."id"',
        '"event"."sendNodeId"',
        '"sendNode"."name" as "sendNode"',
        '"event"."receiveNodeId"',
        '"receiveNode"."name" as "receiveNode"',
        '"event"."status"',
        '"event"."createdAt"',
        '"file"."fileType"',
      ])
      .where({
        sendNodeId,
      })
      .orderBy('"event"."createdAt"', 'DESC');

    const events = await rs
      .limit(limit)
      .offset(page === 1 ? 0 : (page - 1) * limit)
      .getRawMany();

    const total = await rs.getCount();
    const totalPage = events.length ? Math.ceil(total / limit) : 0;
    const hasNextPage = page > 0 && page < totalPage;

    return { events, totalPage, currentPage: page, hasNextPage };
  }

  async create({
    sendNodeId,
    receiveNodeId,
    fileId,
    status,
    policyName,
  }: IGetBySendNodeId) {
    return this.eventRepository
      .createQueryBuilder()
      .insert()
      .into(Event)
      .values([
        {
          sendNodeId,
          receiveNodeId,
          status,
          fileId,
          policyName,
        },
      ])
      .execute();
  }

  async getByFileId(fileId: string) {
    const response: IEventResult[] = (await this.eventRepository
      .createQueryBuilder('event')
      .select()
      .where({
        fileId,
      })
      .execute()) as IEventResult[];
    return response;
  }

  async getByStatus() {
    const repo = this.eventRepository;
    const total = await repo.createQueryBuilder().select().getCount();
    const numberOfFailed = await repo
      .createQueryBuilder()
      .select()
      .where({
        status: 'Failed',
      })
      .getCount();
    const numberOfSucceed = await repo
      .createQueryBuilder()
      .select()
      .where({
        status: 'Succeeded',
      })
      .getCount();
    return { total, numberOfFailed, numberOfSucceed };
  }

  async getNumberOfFilesUpload(sendNodeId: string, receiveNodeId: string) {
    const repo = this.eventRepository;
    let numberOfFailed = 0;
    let numberOfSucceed = 0;
    try {
      numberOfFailed = await repo
        .createQueryBuilder()
        .select()
        .where({
          status: 'Failed',
          sendNodeId: sendNodeId,
          receiveNodeId: receiveNodeId,
        })
        .getCount();
    } catch (err) {
      numberOfFailed = 0;
    }

    try {
      numberOfSucceed = await repo
        .createQueryBuilder()
        .select()
        .where({
          status: 'Succeeded',
          sendNodeId: sendNodeId,
          receiveNodeId: receiveNodeId,
        })
        .getCount();
    } catch (err) {
      numberOfSucceed = 0;
    }

    const total = numberOfFailed + numberOfSucceed;
    return { total, numberOfFailed, numberOfSucceed };
  }

  async getPolicyByNodeId(receiveNodeId: string) {
    const rejectUnauthorized = process.env.NODE_ENV == 'PROD' ? true : false;

    const httpsAgent = new https.Agent({
      ca: fs.readFileSync(ROOT_CA).toString(),
      rejectUnauthorized: rejectUnauthorized,
    });

    const policyURL =
      process.env.CLOUD_URL +
      `/api/policyManager/getPolicyByNodeId/${receiveNodeId}`;

    try {
      const { data } = await lastValueFrom(
        this.httpService.get(policyURL, {
          httpsAgent,
        }),
      );
      return data;
    } catch (err) {
      console.error(`Error fetching policy from ${policyURL}:`, err);
    }
  }

  async sendData(
    @UploadedFile() file: Express.Multer.File,
    @Body() post: { receiveNodeId: string },
  ) {
    return this.getPolicyByNodeId(post.receiveNodeId);
    // define some variables for convenience
    // const sendNodeId = process.env.NODE_ID;
    // const receiveNodeId = post.receiveNodeId;
    //   // path backup azure storage
    //   const path =
    //     `/${process.env.AZURE_STORAGE_CONTAINER}` +
    //     `/${process.env.VM_NAME}/${file.originalname}`;
    //   // set pivot to check condition to send File
    //   let isSuccess = false;
    // get policy of receiveNode to find CPU limit
    // const policy: Array<ResPoliceByNodeId> =
    //   await this.policyManagerService.getPolicyByNodeId(receiveNodeId);
    //   // get some properties about node policy
    //   const policyName = policy[0].policyName;
    //   const cpuLimit = policy[0].cpuOverPercent;
    //   const cpuLessThanPercent = policy[0].cpuLessThanPercent;
    //   const numberResendNode = policy[0].numberResendNode;
    //   // create file Id
    //   const fileId = await this.createFilePath(file, path);
    //   // create event
    //   const insertedEventId: string = await this.createEvent(
    //     sendNodeId,
    //     receiveNodeId,
    //     policyName,
    //     fileId,
    //   );
    //   // emit status PENDING for event send file (FE)
    //   this.socketClient.server.emit(SocketEvents.NODE_INIT, {
    //     id: insertedEventId,
    //     receiveNodeId,
    //     sendNodeId,
    //     status: SocketStatus.PENDING,
    //   });
    //   try {
    //     // get cpu of receive node
    //     const infoCPUNode = await this.nodeService.getCPUByNodeId(
    //       post.receiveNode,
    //     );
    //     const cpu = infoCPUNode.cpuUsage;
    //     if (cpu < cpuLimit) {
    //       // accept to send file
    //       this.eventGateway.sendData(file, post.receiveNode);
    //       // update event and file table
    //       await this.fileService.update(fileId, path);
    //       // update status send file event
    //       await this.update(insertedEventId, STATUS.SUCCESS);
    //       this.eventGateway.server.emit(SocketEvents.CENTRAL_UPDATE, {
    //         id: insertedEventId,
    //         receiveNodeId,
    //         sendNodeId,
    //         status: SocketStatus.SUCCESS,
    //       });
    //       isSuccess = true;
    //     } else {
    //       // throw error
    //       throw Error(insertedEventId);
    //     }
    //   } catch {
    //     // Cant meet cpu condition
    //     // upload to backup
    //     await this.upload(`${process.env.VM_NAME}/`, file);
    //     // update event and file table
    //     await this.fileService.update(fileId, path);
    //     await this.update(insertedEventId, STATUS.FAIL);
    //     this.eventGateway.server.emit(SocketEvents.CENTRAL_UPDATE, {
    //       id: insertedEventId,
    //       receiveNodeId,
    //       sendNodeId,
    //       status: SocketStatus.FAIL,
    //     });
    //   } finally {
    //     this.eventGateway.server.emit(SocketEvents.CENTRAL_UPDATE, {
    //       id: insertedEventId,
    //       receiveNodeId,
    //       sendNodeId,
    //       status: SocketStatus.DONE,
    //     });
    //   }
    //   if (!isSuccess) {
    //     // get available Node
    //     const availableNode = await this.nodeService.getAvailableNode(
    //       process.env.NODE_ID,
    //       cpuLessThanPercent,
    //       numberResendNode,
    //     );
    //     const promises = [];
    //     for (const node of availableNode) {
    //       promises.push(
    //         this.sendData(file, { receiveNode: node.nodeId }).catch((err) =>
    //           console.log(err),
    //         ),
    //       );
    //     }
    //     Promise.all(promises)
    //       .then((response) => console.log(response))
    //       .catch((err) => console.log(err));
    //   }
  }
}
