import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from '../entity/file.entity';
import { IFileResult } from '../interface';
@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File) public fileRepository: Repository<File>,
  ) {}

  /**
   * Find all Edges with corresponding RSUs, OBUs
   * @returns {Promise<ListNodeDto>}
   */
  create = async (file: Express.Multer.File) => {
    const fileName =
      file.originalname.substring(0, file.originalname.lastIndexOf('.')) || '';
    const fileType =
      file.originalname.substring(
        file.originalname.lastIndexOf('.'),
        file.originalname.length,
      ) || '';
    return this.fileRepository
      .createQueryBuilder()
      .insert()
      .into(File)
      .values([
        {
          fileName,
          fileType: fileName !== 'undefined' ? fileType : 'undefined',
          path:
            fileName !== 'undefined' ? `/${file.originalname}` : 'undefined',
        },
      ])
      .execute();
  };

  findByFileName = async (fileName: string): Promise<string> => {
    const result: IFileResult[] = (await this.fileRepository
      .createQueryBuilder('file')
      .select()
      .where({
        fileName,
      })
      .execute()) as IFileResult[];
    return result?.[0]?.file_id;
  };
}
