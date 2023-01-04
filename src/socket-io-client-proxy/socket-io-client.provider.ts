import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Socket, io } from 'socket.io-client';
import * as fs from 'fs';
@Injectable()
export class SocketIoClientProvider {
  @Inject(ConfigService)
  private readonly config: ConfigService;

  private socket: Socket;

  private connect() {
    const rootCA = 'cert/ca-cert.pem';
    this.socket = io(process.env.CLOUD_URL, {
      ca: fs.existsSync(rootCA) && fs.readFileSync(rootCA).toString(),
    });
    return this.socket;
  }

  getSocket = () => {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  };
}
