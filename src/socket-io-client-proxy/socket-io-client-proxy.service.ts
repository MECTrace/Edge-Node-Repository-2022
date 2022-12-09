import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, ReadPacket, WritePacket } from '@nestjs/microservices';
import { WebSocketGateway } from '@nestjs/websockets';
import { WEB_SOCKET_GATEWAY } from 'src/constants';
import { SocketIoClientProvider } from './socket-io-client.provider';
@WebSocketGateway({
  cors: WEB_SOCKET_GATEWAY,
})
@Injectable()
export class SocketIoClientProxyService extends ClientProxy {
  @Inject(SocketIoClientProvider)
  private client: SocketIoClientProvider;

  connect(): Promise<any> {
    return Promise.resolve(this.client.getSocket());
  }

  close() {
    this.client.getSocket().disconnect();
  }

  dispatchEvent(packet: ReadPacket<any>): Promise<any> {
    this.client.getSocket().emit(packet.pattern, packet.data);
    return Promise.resolve(packet);
  }

  publish(
    packet: ReadPacket<any>,
    callback: (packet: WritePacket<any>) => void,
  ) {
    return () => console.log('teardown', packet, callback);
  }
}
