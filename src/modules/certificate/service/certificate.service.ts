import { InjectRepository } from '@nestjs/typeorm';
import { X509Certificate } from 'crypto';
import { Repository } from 'typeorm';
import { Node } from '../../node/entity/node.entity';
import { Certificate } from '../entity/certificate.entity';
import { ICertificateRes, IIssuedCertificate } from '../interfaces';
import * as fs from 'fs';

export class CertificateService {
  constructor(
    @InjectRepository(Certificate)
    private certificateRepository: Repository<Certificate>,
  ) {}

  checkCertificateIssue(certificate: Buffer) {
    const certificateData = new X509Certificate(certificate);
    const expiredDay = certificateData.validTo;
    const certExpiredDay = new Date(expiredDay);
    const currentDate = new Date();
    if (certExpiredDay < currentDate) return 'Certificate Expired';
    return 'None';
  }

  async getAllCertificates(): Promise<ICertificateRes> {
    return this.certificateRepository
      .createQueryBuilder('certificate')
      .innerJoin(Node, 'node', 'certificate.nodeId = node.id')
      .select([
        '"certificate"."id"',
        '"certificate"."nodeId"',
        '"node"."name"',
        '"certificate"."expiredDay"',
        '"certificate"."issuedDate"',
        '"certificate"."isIssued"',
        '"certificate"."createdAt"',
        '"certificate"."updatedAt"',
        '"certificate"."certificateIssue"',
        'status',
      ])
      .orderBy('"node"."name"', 'ASC')
      .execute() as Promise<ICertificateRes>;
  }

  async generateCertificateData(listNode: { id: string; name: string }[]) {
    try {
      await Promise.all([
        listNode.map(async (item: { id: string; name: string }) => {
          const isExist = await this.certificateRepository.findOne({
            nodeId: item.id,
          });
          if (!isExist) {
            await this.certificateRepository
              .createQueryBuilder()
              .insert()
              .into(Certificate)
              .values([
                {
                  nodeId: item.id,
                  expiredDay: new Date(),
                  issuedDate: new Date(),
                  certificateIssue: 'No Certificate',
                  isIssued: false,
                },
              ])
              .execute();
          }
        }),
      ]);
      return { status: 'succeeded' };
    } catch (err) {
      console.log(err);
      return { status: 'failed' };
    }
  }

  async insertCertificateData(certificate: Buffer) {
    try {
      const certificateData = new X509Certificate(certificate);
      const expiredDay = certificateData.validTo;
      const issuedDate = certificateData.validFrom;
      const nodeId = process.env.NODE_ID;

      const certExpiredDay = new Date(expiredDay);
      const currentDate = new Date();

      const certificateIssue =
        certExpiredDay < currentDate ? 'Certificate Expired' : 'None';

      const rootCA = new X509Certificate(
        fs.readFileSync(`cert/${process.env.CA_CERT}`),
      );

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

  async getExpiredCertificate() {
    const expiredCertificate = await this.certificateRepository
      .createQueryBuilder()
      .select()
      .where('"Certificate"."expiredDay" < Now()')
      .getRawMany();

    return {
      expiredCertificate,
      total: expiredCertificate.length || 0,
    };
  }

  async getIssuedCertificate(): Promise<IIssuedCertificate> {
    const issuedCertificate = await this.certificateRepository
      .createQueryBuilder()
      .select()
      .where('"Certificate"."isIssued" = true')
      .getRawMany();

    return {
      issuedCertificate,
      total: issuedCertificate.length || 0,
    };
  }
}
