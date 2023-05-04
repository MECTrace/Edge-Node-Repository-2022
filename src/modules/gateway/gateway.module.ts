import { Module } from '@nestjs/common';
// import { ServerGateway } from './gateway-server';
import { ClientGateway } from './gateway-client';

@Module({
  providers: [ClientGateway],
  exports: [ClientGateway],
})
export class GatewayModule {}
