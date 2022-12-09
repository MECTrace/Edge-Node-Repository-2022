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
    this.socket = io(process.env.CLOUD_URL, {
      ca: fs.readFileSync('cert/ca-cert.pem').toString(),
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
