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

  //*******************/
  //* File operations */
  //*******************/

  async syncFilesFromS3ToDatabase() {
    // [step 1] Check if the s3File table is empty.
    const count = await this.prisma.s3File.count();
    if (count > 0) {
      throw new Error(
        'The s3File table is not empty. Please clear the table before syncing.'
      );
    }

    // [step 2] Get all objects from S3 bucket.
    const objects = await this.s3.getObjectsRecursively({});

    // [step 3] Create records in the s3File table.
    const files: {
      name: string;
      type: string;
      size?: number;
      s3Bucket: string;
      s3Key: string;
    }[] = [];

    for (const {s3Key, size} of objects) {
      let fileName = '';
      let fileType = '';
      let fileSize = size;

      if (s3Key.endsWith('/')) {
        fileName = s3Key.slice(0, -1).split('/').pop() || '';
        fileType = 'folder';
      } else {
        fileName = s3Key.split('/').pop() || '';
        fileType = s3Key.split('.').pop() || '';
      }

      files.push({
        name: fileName,
        type: fileType,
        size: fileSize,
        s3Bucket: this.bucket,
        s3Key: s3Key,
      });
    }

    await this.prisma.s3File.createMany({
      data: files,
    });
  }

  /** Create a folder in AWS S3, then create a record in the database. */
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
          type: 'folder',
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

  /**  Upload file to local server, then upload to AWS S3. */
  async uploadFile(params: {
    file: Express.Multer.File;
    parentId?: string; // Do not use both `parentId` and `path` at the same time.
    path?: string; // The folder path to upload the file, e.g. 'uploads', not including `/` at the end.
    overwrite?: boolean; // Whether to overwrite the existing file
    useOriginalName?: boolean; // Whether to use the original file name, true and undefined are both true.
  }) {
    if (params.overwrite) {
      const existingFile = await this.prisma.s3File.findFirst({
        where: {
          name: params.file.originalname,
          s3Bucket: this.bucket,
          parentId: params.parentId,
        },
        select: {id: true, s3Key: true},
      });
      if (existingFile) {
        // Upload to AWS S3 with the existing file's s3Key to overwrite it.
        const output = await this.s3.putObject({
          key: existingFile.s3Key,
          body: params.file.buffer,
        });

        return await this.prisma.s3File.update({
          where: {id: existingFile.id},
          data: {
            name: params.file.originalname,
            type: params.file.mimetype,
            size: params.file.size,
            s3Response: output as object,
          },
          select: {id: true, name: true},
        });
      }
    }

    // [step 1] Generate s3Key.
    let s3Key: string;
    if (
      params.useOriginalName === undefined ||
      params.useOriginalName === true
    ) {
      if (params.parentId) {
        s3Key =
          (await this.getFilePathString(params.parentId)) +
          `/${params.file.originalname}`;
      } else if (params.path) {
        s3Key = `${params.path}/${params.file.originalname}`;
      } else {
        s3Key = params.file.originalname;
      }
    } else {
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
    return await this.prisma.s3File.create({
      data: {
        name: params.file.originalname,
        type: params.file.mimetype,
        size: params.file.size,
        s3Bucket: this.bucket,
        s3Key: s3Key,
        s3Response: output as object,
        parentId: params.parentId,
      },
      select: {id: true, name: true},
    });

    // return {
    //   url: `https://${s3File.s3Bucket}.s3.${this.region}.amazonaws.com/${s3File.s3Key}`,
    //   cdnUrl: this.cdnHostname
    //     ? `${this.cdnHostname}/${s3File.s3Key}`
    //     : undefined,
    // };
  }

  // Delete a file in AWS S3, then delete the record in the database.
  async deleteFile(fileId: string) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {id: fileId},
    });

    try {
      await this.s3.deleteObjectRecursively({
        bucket: file.s3Bucket,
        key: file.s3Key,
      });
      await this.deleteFileRecursively(fileId);
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

  //*******************************/
  //* Multipart upload operations */
  //*******************************/

  async createMultipartUpload(params: {
    originalname: string;
    mimetype: string;
    size: number;
    parentId?: string;
    path?: string;
  }) {
    // [step 1] Generate s3Key.
    const s3Key = await this.generateS3Key({
      originalname: params.originalname,
      parentId: params.parentId,
      path: params.path,
    });

    // [step 2] Create a record and initiate multipart upload.
    const uploadRsp = await this.s3.createMultipartUpload({
      key: s3Key,
      bucket: this.bucket,
    });

    // [step 3] Create a record.
    return await this.prisma.s3File.create({
      data: {
        name: params.originalname,
        type: params.mimetype,
        size: params.size,
        s3Bucket: this.bucket,
        s3Key: s3Key,
        parentId: params.parentId,
        uploadId: uploadRsp.UploadId,
        uploadProgress: 0, // Initialize progress to 0
      },
    });
  }

  async uploadPart(params: {
    uploadId: string;
    uploadProgress: number;
    partNumber: number;
    body: Buffer | Uint8Array | Blob | string;
  }) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {uploadId: params.uploadId},
    });

    await this.prisma.s3File.update({
      where: {id: file.id},
      data: {uploadProgress: params.uploadProgress},
    });

    return await this.s3.uploadPart({
      bucket: file.s3Bucket,
      key: file.s3Key,
      ...params,
    });
  }

  async completeMultipartUpload(params: {
    uploadId: string;
    parts: {ETag: string; PartNumber: number}[];
  }) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {uploadId: params.uploadId},
    });

    const response = await this.s3.completeMultipartUpload({
      bucket: file.s3Bucket,
      key: file.s3Key,
      parts: params.parts,
      uploadId: params.uploadId,
    });

    return await this.prisma.s3File.update({
      where: {id: file.id},
      data: {
        s3Response: response as object,
        uploadProgress: 100, // Set progress to 100% after completion
      },
    });
  }

  async abortMultipartUpload(uploadId: string) {
    const file = await this.prisma.s3File.findFirstOrThrow({
      where: {uploadId},
      select: {s3Bucket: true, s3Key: true},
    });

    return await this.s3.abortMultipartUpload({
      bucket: file.s3Bucket,
      key: file.s3Key,
      uploadId,
    });
  }

  //*****************************/
  //* Get signed URL operations */
  //*****************************/

  /*
   * Create a file record in database and return a signed URL for uploading a file to AWS S3.
   * This URL can be used by the user to upload a file directly to S3.
   * The URL will expire after a certain period of time, which is defined in the AWS S3 configuration.
   * https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
   */
  async getSignedUploadUrl(params: {
    originalname: string;
    mimetype: string;
    size: number;
    parentId?: string;
    path?: string;
  }) {
    // [step 1] Generate s3Key.
    const s3Key = await this.generateS3Key({
      originalname: params.originalname,
      parentId: params.parentId,
      path: params.path,
    });

    // [step 2] Create a record.
    const file = await this.prisma.s3File.create({
      data: {
        name: params.originalname,
        type: params.mimetype,
        size: params.size,
        s3Bucket: this.bucket,
        s3Key: s3Key,
        parentId: params.parentId,
      },
    });

    return await this.s3.getSignedUploadUrl({
      bucket: file.s3Bucket,
      key: file.s3Key,
    });
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

  //*********************/
  //* Private functions */
  //*********************/

  private async deleteFileRecursively(fileId: string) {
    // [step 1] Delete file.
    await this.prisma.s3File.delete({where: {id: fileId}});

    // [step 2] Delete files in the folder.
    const filesInFolder = await this.prisma.s3File.findMany({
      where: {parentId: fileId},
      select: {id: true},
    });

    for (let i = 0; i < filesInFolder.length; i++) {
      await this.deleteFileRecursively(filesInFolder[i].id);
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

  private async generateS3Key(params: {
    originalname: string;
    parentId?: string;
    path?: string;
  }) {
    let s3Key: string;

    if (params.parentId) {
      s3Key =
        (await this.getFilePathString(params.parentId)) +
        `/${generateUuid()}${extname(params.originalname)}`;
    } else if (params.path) {
      s3Key = `${params.path}/${generateUuid()}${extname(params.originalname)}`;
    } else {
      s3Key = `${generateUuid()}${extname(params.originalname)}`;
    }

    return s3Key;
  }
}
