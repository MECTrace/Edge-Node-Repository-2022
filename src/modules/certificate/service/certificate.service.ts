import { InjectRepository } from '@nestjs/typeorm';
import { X509Certificate } from 'crypto';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { Node } from '../../node/entity/node.entity';
import { Certificate } from '../entity/certificate.entity';

export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
  ) {}

  async insertCertificateData(certificate: Buffer) {
    try {
      const certificateData = new X509Certificate(certificate);
      const expiredDay = certificateData.validTo;
      const issuedDate = certificateData.validFrom;
      const nodeId = process.env.NODE_ID;

      const certExpiredDay = new Date(expiredDay);
      const currentDate = new Date();

      const certificateIssue =
        certExpiredDay <= currentDate ? 'Certificate Expired' : 'None';
      console.log('certificateIssue', certificateIssue);
      console.log('certExpiredDay', certExpiredDay);

      const rootCA = new X509Certificate(fs.readFileSync('cert/ca-cert.pem'));

      const isIssued = certificateData.checkIssued(rootCA);

      const isExist = await this.certificateRepository.findOne({
        nodeId,
      });

      await this.certificateRepository
        .createQueryBuilder()
        .update(Node)
        .set({
          status: 'On',
        })
        .where({
          id: nodeId,
        })
        .execute();

      if (!isExist) {
        await this.certificateRepository
          .createQueryBuilder()
          .insert()
          .into(Certificate)
          .values([
            {
              nodeId,
              expiredDay,
              issuedDate,
              certificateIssue,
              isIssued,
            },
          ])
          .execute();
      } else {
        await this.certificateRepository
          .createQueryBuilder()
          .update(Certificate)
          .set({
            expiredDay,
            issuedDate,
            certificateIssue,
            isIssued,
          })
          .where({
            nodeId,
          })
          .execute();
      }
    } catch (err) {
      console.log(err);
    }
  }

  async removeCertificate() {
    try {
      // fs.unlinkSync('cert/edge-cert.txt');
      // fs.unlinkSync('cert/edge-key.txt');
      // fs.unlinkSync('cert/edge-req.txt');
      await this.certificateRepository
        .createQueryBuilder()
        .update(Certificate)
        .set({
          certificateIssue: 'No Certificate',
          isIssued: false,
        })
        .where({
          nodeId: process.env.NODE_ID,
        })
        .execute();
    } catch (err) {
      console.error(err);
    }
  }
}
