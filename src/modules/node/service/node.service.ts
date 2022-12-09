import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from '../entity/node.entity';

@Injectable()
export class NodeService {
  constructor(
    @InjectRepository(Node) private nodeRepository: Repository<Node>,
  ) {}

  /**
   * Find all Edges with corresponding RSUs, OBUs
   * @returns {Promise<ListNodeDto>}
   */
  async findAll(): Promise<Node[]> {
    return this.nodeRepository.find();
  }

  async findOne(id: string): Promise<Node> {
    return this.nodeRepository.findOne({
      name: id,
    });
  }

  async getNode(): Promise<{ id: string; name: string }[]> {
    return this.nodeRepository
      .createQueryBuilder()
      .select(['id', 'name'])
      .execute() as Promise<{ id: string; name: string }[]>;
  }
}
