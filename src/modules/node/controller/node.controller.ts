import { Controller, Get, Put, Patch, Param, Body } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { NodeService } from '../service/node.service';

@ApiTags('Node')
@Controller('Node')
export class NodeController {
  constructor(private nodeService: NodeService) {}

  @Get('getCPUCurrentNode')
  @ApiOperation({
    description: `Get CPU of Current Node`,
  })
  @ApiOkResponse({
    status: 200,
    description: 'Get CPU successfully',
  })
  getCPUCurrentNode() {
    return this.nodeService.getCPUCurrentNode();
  }
}
