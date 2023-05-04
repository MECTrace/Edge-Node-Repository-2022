import { Injectable, UploadedFile } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';

@Injectable()
export class ClientGateway {
  public socketClient: Socket;

  constructor() {
    const rootCA = 'cert/ca-cert.pem';
    this.socketClient = io(process.env.CLOUD_URL, {
      ca: fs.existsSync(rootCA) && fs.readFileSync(rootCA).toString(),
      extraHeaders: {
        nodeId: process.env.NODE_ID,
      },
    });

    this.socketClient.on('connection', (data) => {
      console.log('Connected to', data.server);
    });

    this.socketClient.on('send-data', (data) => {
      console.log(data);
    });
  }

  sendData(@UploadedFile() file: Express.Multer.File, receiveNodeId: string) {
    this.socketClient.emit('send-data', {
      sendNodeId: process.env.NODE_ID,
      receiveNodeId: receiveNodeId,
      data: file,
      timestamp: new Date().getTime(),
    });
  }
}
