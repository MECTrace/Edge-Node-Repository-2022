import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NodeService } from '../service/node.service';

@ApiTags('Node')
@Controller('Node')
export class NodeController {
  constructor(private nodeService: NodeService) {}
}
