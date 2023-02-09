import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from '../entity/node.entity';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NodeService {
  constructor(
    @InjectRepository(Node) private nodeRepository: Repository<Node>,
    private httpService: HttpService,
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

  // get token to access azure
  async getAccessToken() {
    const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/token`

    const payload = {
      grant_type: 'client_credentials',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      resource: 'https://management.azure.com/',
    };

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const { data } = await firstValueFrom(
      this.httpService.post(url, payload, { headers: headers }),
    );
    return data.access_token;
  }


  // get cpu by vmName
  async getCPU(vmName: string) {
    const access_token = await this.getAccessToken();

    const headersRequest = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
    };

    const now = new Date();
    const beginTime = new Date(
      new Date().setTime(now.getTime() - 10 * 60 * 1000),
    ).toISOString();
    const endTime = new Date(now).toISOString();

    const url =
      `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/` +
      `resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${vmName}/providers/` +
      `microsoft.insights/metrics?api-version=2018-01-01&metricnames=Percentage%20CPU&` +
      `timespan=${beginTime}/${endTime}`;

    const { data } = await firstValueFrom(
      this.httpService.get(url, { headers: headersRequest }),
    );

    const timeseries_data = data.value[0].timeseries[0].data;
    for (let i = timeseries_data.length - 1; i >= 0; i--) {
      if (Object.keys(timeseries_data[i]).length == 2) {
        return timeseries_data[i];
      }
    }
  }


  // get CPU current node
  async getCPUCurrentNode() {
    const cpu_usage = await this.getCPU(process.env.VM_NAME);
    return {
      vmName: process.env.VM_NAME,
      cpuUsage: cpu_usage.average,
      updateAt: cpu_usage.timeStamp,
    };
  }
}
