import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import { EventService } from 'src/modules/event/service/event.service';
import { CertificateService } from '../service/certificate.service';
@ApiTags('certificate')
@Controller('certificate')
export class CertificateController {
  constructor(
    private certificateService: CertificateService,
    private eventService: EventService,
  ) {}

  @Get('forceUploadCertificate')
  @ApiOkResponse({
    status: 200,
    description: 'Push Certificate to Cloud Storage for Monitoring',
  })
  async forceUploadCertificates() {
    try {
      await this.certificateService.insertCertificateData(
        fs.readFileSync(`cert/${process.env.NODE_CERT}`),
      );

      const cert = fs.readFileSync(`cert/${process.env.NODE_CERT}`);

      await this.eventService.forceUploadCertificates(
        cert,
        process.env.NODE_CERT,
      );

      return { status: 'succeeded' };
    } catch (err) {
      console.log(err);
      return { status: 'failed' };
    }
  }
}
