import { Injectable, OnModuleInit } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import * as fs from 'fs';
import { OnApplicationBootstrap } from '@nestjs/common';
@Injectable()
export class SocketClient implements OnModuleInit, OnApplicationBootstrap {
  public socketClient: Socket;

  constructor() {
    const rootCA = 'cert/ca-cert.pem';
    this.socketClient = io(process.env.CLOUD_URL, {
      ca: fs.existsSync(rootCA) && fs.readFileSync(rootCA).toString(),
      extraHeaders: {
        node_id: process.env.NODE_ID,
      },
    });
  }

  onModuleInit() {
    this.socketClient.on('connection', (data) => {
      console.log('Connected to', data.server);
    });
  }

  onApplicationBootstrap() {
    this.socketClient.on('sendData', (data) => {
      console.log('xxx', data);
    });
  }
}
