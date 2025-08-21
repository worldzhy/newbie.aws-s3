import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  GetObjectCommandInput,
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

@Injectable()
export class AwsS3Service {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private signedUrlExpiresIn: number;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('microservices.aws-s3.bucket');
    this.region = this.config.getOrThrow<string>('microservices.aws-s3.region');
    this.signedUrlExpiresIn = this.config.getOrThrow<number>(
      'microservices.aws-s3.signedUrlExpiresIn'
    );

    const accessKeyId = this.config.get<string>(
      'microservices.aws-s3.accessKeyId'
    );
    const secretAccessKey = this.config.get<string>(
      'microservices.aws-s3.secretAccessKey'
    );
    if (accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: this.region,
        credentials: {accessKeyId, secretAccessKey},
      });
    } else {
      this.client = new S3Client({
        region: this.region,
      });
    }
  }

  //*********************/
  //* Bucket operations */
  //*********************/

  async createBucket(bucketName: string) {
    return await this.client.send(
      new CreateBucketCommand({Bucket: bucketName})
    );
  }

  async deleteBucket(bucketName: string) {
    return await this.client.send(
      new DeleteBucketCommand({Bucket: bucketName})
    );
  }

  //*********************/
  //* Object operations */
  //*********************/

  async getObject(params: {bucket?: string; key: string}) {
    return await this.client.send(
      new GetObjectCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
      })
    );
  }

  async putObject(params: {
    bucket?: string;
    key: string;
    body?: Buffer | string;
  }) {
    return await this.client.send(
      new PutObjectCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
        Body: params.body,
      })
    );
  }

  async deleteObjectRecursively(params: {bucket: string; key: string}) {
    try {
      // [step 1] List objects
      const listResponse = await this.client.send(
        new ListObjectsV2Command({
          Bucket: params.bucket ?? this.bucket,
          Prefix: params.key,
        })
      );
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return;
      }

      // [step 2] Delete objects
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: params.bucket,
          Delete: {
            Objects: listResponse.Contents.map(content => {
              return {Key: content.Key};
            }),
          },
        })
      );

      // https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
      // IsTruncated: Set to false if all of the results were returned. Set to true if more keys are available to return. If the number of results exceeds that specified by MaxKeys, all of the results might not be returned.
      if (listResponse.IsTruncated) {
        await this.deleteObjectRecursively(params);
      }
    } catch (error) {
      // TODO (developer) - Handle exception
      throw error;
    }
  }

  async getObjectsRecursively(params: {bucket?: string; prefix?: string}) {
    const allKeys: {s3Key: string; size?: number}[] = [];
    try {
      // [step 1] List objects
      const listResponse = await this.client.send(
        new ListObjectsV2Command({
          Bucket: params.bucket ?? this.bucket,
          Prefix: params.prefix,
        })
      );

      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        return allKeys;
      } else {
        allKeys.push(
          ...listResponse.Contents.map(content => {
            return {s3Key: content.Key!, size: content.Size};
          })
        );
      }

      // https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
      // IsTruncated: Set to false if all of the results were returned. Set to true if more keys are available to return. If the number of results exceeds that specified by MaxKeys, all of the results might not be returned.
      if (listResponse.IsTruncated) {
        const keys = await this.getObjectsRecursively(params);
        allKeys.push(...keys);
      } else {
        return allKeys;
      }
    } catch (error) {
      // TODO (developer) - Handle exception
      throw error;
    } finally {
      return allKeys;
    }
  }

  //*******************************/
  //* Multipart upload operations */
  //*******************************/

  async createMultipartUpload(params: {bucket?: string; key: string}) {
    return await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
      })
    );
  }

  async uploadPart(params: {
    bucket?: string;
    key: string;
    body: Buffer | Uint8Array | Blob | string;
    partNumber: number;
    uploadId: string;
  }) {
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
        Body: params.body,
        PartNumber: params.partNumber,
        UploadId: params.uploadId,
      })
    );

    return {
      ETag: response.ETag,
      PartNumber: params.partNumber,
    };
  }

  async completeMultipartUpload(params: {
    bucket?: string;
    key: string;
    parts: {ETag: string; PartNumber: number}[];
    uploadId: string;
  }) {
    return await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
        MultipartUpload: {Parts: params.parts},
        UploadId: params.uploadId,
      })
    );
  }

  async abortMultipartUpload(params: {
    bucket?: string;
    key: string;
    uploadId: string;
  }) {
    return await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: params.bucket ?? this.bucket,
        Key: params.key,
        UploadId: params.uploadId,
      })
    );
  }

  //*****************************/
  //* Get signed URL operations */
  //*****************************/

  /** Get a signed URL to access an S3 object for signedUrlExpiresIn seconds */
  async getSignedDownloadUrl(params: {bucket?: string; key: string}) {
    const command = new GetObjectCommand({
      Bucket: params.bucket ?? this.bucket,
      Key: params.key,
    });

    return await getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresIn,
    });
  }

  /** Get a signed URL to upload an S3 object for signedUrlExpiresIn seconds */
  async getSignedUploadUrl(params: {bucket?: string; key: string}) {
    const command = new PutObjectCommand({
      Bucket: params.bucket ?? this.bucket,
      Key: params.key,
    });

    return await getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresIn,
    });
  }

  /** Get a signed URL to upload a part in a multipart upload */
  async getSignedMultipartUploadUrl(params: {
    bucket?: string;
    key: string;
    partNumber: number;
    uploadId: string;
  }) {
    const command = new UploadPartCommand({
      Bucket: params.bucket ?? this.bucket,
      Key: params.key,
      PartNumber: params.partNumber,
      UploadId: params.uploadId,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresIn,
    });
  }
}
