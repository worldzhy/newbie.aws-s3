import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@framework/prisma/prisma.service';
import {generateUuid} from '@framework/utilities/random.util';
import {extname} from 'path';
import {AwsS3Service} from './aws-s3.service';

@Injectable()
export class AwsS3FileService {
  private bucket: string;
  private region: string;
  private cdnHostname: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly s3: AwsS3Service
  ) {
    this.bucket = this.config.getOrThrow<string>('microservices.aws-s3.bucket');
    this.region = this.config.getOrThrow<string>('microservices.aws-s3.region');
    this.cdnHostname = this.config.get<string>(
      'microservices.aws-s3.cdnHostname'
    );
  }

  // User downloads a file from AWS S3 directly.
  // https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
  async getSignedDownloadUrl(fileId: string) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {id: fileId},
      select: {s3Bucket: true, s3Key: true},
    });

    return this.s3.getSignedDownloadUrl({
      bucket: file.s3Bucket,
      key: file.s3Key,
    });
  }

  // User uploads a file to AWS S3 directly, then create a record in the database.
  // https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
  async getSignedUploadUrl(params: {
    file: {originalname: string; mimetype: string; size: number};
    parentId?: string;
    path?: string;
  }) {
    // [step 1] Generate s3Key.
    let s3Key: string;
    if (params.parentId) {
      s3Key =
        (await this.getFilePathString(params.parentId)) +
        `/${generateUuid()}${extname(params.file.originalname)}`;
    } else if (params.path) {
      s3Key = `${params.path}/${generateUuid()}${extname(params.file.originalname)}`;
    } else {
      s3Key = `${generateUuid()}${extname(params.file.originalname)}`;
    }

    // [step 2] Create a record.
    const file = await this.prisma.s3File.create({
      data: {
        name: params.file.originalname,
        type: params.file.mimetype,
        size: params.file.size,
        s3Bucket: this.bucket,
        s3Key: s3Key,
        parentId: params.parentId,
      },
    });

    return this.s3.getSignedUploadUrl({
      bucket: file.s3Bucket,
      key: file.s3Key,
    });
  }

  // Create a folder in AWS S3, then create a record in the database.
  async createFolder(params: {name: string; parentId?: string}) {
    let s3Key = params.name;
    if (params.parentId) {
      s3Key =
        (await this.getFilePathString(params.parentId)) + '/' + params.name;
    }

    const output = await this.s3.putObject({key: s3Key + '/'});
    return await this.prisma.s3File.create({
      data: {
        name: params.name,
        type: 'Folder',
        s3Bucket: this.bucket,
        s3Key: s3Key,
        s3Response: output as object,
        parentId: params.parentId,
      },
    });
  }

  // User upload file to local server, then upload to AWS S3.
  async uploadFile(params: {
    file: Express.Multer.File;
    parentId?: string;
    path?: string;
  }) {
    // [step 1] Generate s3Key.
    let s3Key: string;
    if (params.parentId) {
      s3Key =
        (await this.getFilePathString(params.parentId)) +
        `/${generateUuid()}${extname(params.file.originalname)}`;
    } else if (params.path) {
      s3Key = `${params.path}/${generateUuid()}${extname(params.file.originalname)}`;
    } else {
      s3Key = `${generateUuid()}${extname(params.file.originalname)}`;
    }

    // [step 2] Put file to AWS S3.
    const output = await this.s3.putObject({
      key: s3Key,
      body: params.file.buffer,
    });

    // [step 3] Create a record.
    const s3File = await this.prisma.s3File.create({
      data: {
        name: params.file.originalname,
        type: params.file.mimetype,
        size: params.file.size,
        s3Bucket: this.bucket,
        s3Key: s3Key,
        s3Response: output as object,
        parentId: params.parentId,
      },
    });

    return {
      url: `https://${s3File.s3Bucket}.s3.${this.region}.amazonaws.com/${s3File.s3Key}`,
      cdnUrl: this.cdnHostname
        ? `${this.cdnHostname}/${s3File.s3Key}`
        : undefined,
    };
  }

  // Delete a file in AWS S3, then delete the record in the database.
  async deleteFile(fileId: string) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {id: fileId},
    });

    try {
      await this.s3.deleteFileInS3Recursively({
        bucket: file.s3Bucket,
        key: file.s3Key,
      });
      await this.deleteFileInDatabaseRecursively(fileId);
    } catch (error) {
      // TODO (developer) - Handle exception
      throw error;
    }
  }

  // Get the file path.
  async getFilePath(fileId: string) {
    const path: object[] = [];

    // [step 1] Get current file.
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {id: fileId},
      select: {id: true, name: true, type: true, parentId: true},
    });
    path.push(file);

    // [step 2] Get parent file.
    if (file.parentId) {
      path.push(...(await this.getFilePath(file.parentId)));
    } else {
      // Do nothing.
    }

    return path;
  }

  /**
   * Remove directories and their contents recursively
   */
  private async deleteFileInDatabaseRecursively(fileId: string) {
    // [step 1] Delete file.
    await this.prisma.s3File.delete({where: {id: fileId}});

    // [step 2] Delete files in the folder.
    const filesInFolder = await this.prisma.s3File.findMany({
      where: {parentId: fileId},
      select: {id: true},
    });

    for (let i = 0; i < filesInFolder.length; i++) {
      await this.deleteFileInDatabaseRecursively(filesInFolder[i].id);
    }
  }

  private async getFilePathString(fileId: string) {
    let path = '';

    // [step 1] Get current file.
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {id: fileId},
      select: {id: true, name: true, type: true, parentId: true},
    });
    path = file.name;

    // [step 2] Get parent file.
    if (file.parentId) {
      path = (await this.getFilePathString(file.parentId)) + '/' + path;
    } else {
      // Do nothing.
    }

    return path;
  }
}
