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

  /*
   * Get a signed URL for downloading a file from AWS S3.
   * This URL can be used by the user to download the file directly from S3.
   * The URL will expire after a certain period of time, which is defined in the AWS S3 configuration.
   * https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
   */
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

  /*
   * Get a signed URL for uploading a file to AWS S3.
   * This URL can be used by the user to upload a file directly to S3.
   * The URL will expire after a certain period of time, which is defined in the AWS S3 configuration.
   * https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
   */
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

  /*
   * Create a folder in AWS S3, then create a record in the database.
   */
  async createFolder(params: {
    name: string; // The folder name, e.g. 'uploads', 'uploads/images'.
    parentId?: string; // The parent folder ID, if not provided, the folder will be created in the root directory.
  }) {
    let parentId = params.parentId;
    let s3Key = '';

    // If there are `/` in the folder name, create multi-level folders.
    const folderNames = params.name.split('/');
    if (folderNames.length === 1 && folderNames[0].length === 0) {
      throw new Error('Folder name cannot be empty.');
    }

    for (let i = 0, j = 0; i < folderNames.length; i++) {
      if (folderNames[i].length === 0) {
        continue; // Skip empty folder names.
      }

      if (j === 0) {
        if (params.parentId) {
          s3Key =
            (await this.getFilePathString(params.parentId)) +
            '/' +
            folderNames[i];
        } else {
          s3Key = folderNames[i];
        }
      } else {
        s3Key = s3Key + '/' + folderNames[i];
      }

      const output = await this.s3.putObject({key: s3Key + '/'});
      const folder = await this.prisma.s3File.create({
        data: {
          name: folderNames[i],
          type: 'Folder',
          s3Bucket: this.bucket,
          s3Key: s3Key,
          s3Response: output as object,
          parentId: parentId,
        },
      });

      parentId = folder.id; // Update parentId for the next iteration.
      j++; // Increment j to track the level of folder creation.
    }

    return parentId; // Return the ID of the last created folder.
  }

  /*
   *  Upload file to local server, then upload to AWS S3.
   */
  async uploadFile(params: {
    file: Express.Multer.File;
    parentId?: string; // Do not use both `parentId` and `path` at the same time.
    path?: string; // The folder path to upload the file, e.g. 'uploads', not including `/` at the end.
    overwrite?: boolean; // Whether to overwrite the existing file
  }) {
    // [step 1] Generate s3Key.
    let s3Key: string | undefined = undefined;

    if (params.overwrite) {
      const existingFile = await this.prisma.s3File.findFirst({
        where: {
          name: params.file.originalname,
          s3Bucket: this.bucket,
          parentId: params.parentId,
        },
      });
      if (existingFile) {
        s3Key = existingFile.s3Key;
      }
    }

    if (!s3Key) {
      if (params.parentId) {
        s3Key =
          (await this.getFilePathString(params.parentId)) +
          `/${generateUuid()}${extname(params.file.originalname)}`;
      } else if (params.path) {
        s3Key = `${params.path}/${generateUuid()}${extname(params.file.originalname)}`;
      } else {
        s3Key = `${generateUuid()}${extname(params.file.originalname)}`;
      }
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
