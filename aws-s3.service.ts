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
import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

@Injectable()
export class AwsS3Service {
  private bucket: string;
  private region: string;
  private client: S3Client;
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

  async getObject(params: GetObjectCommandInput) {
    const {Bucket, Key} = params;
    return await this.client.send(new GetObjectCommand({Bucket, Key}));
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

  /**
   * Remove directories and their contents recursively
   */
  async deleteFileInS3Recursively(params: {bucket: string; key: string}) {
    try {
      // [step 1] List objects
      const listResponse = await this.client.send(
        new ListObjectsV2Command({Bucket: params.bucket, Prefix: params.key})
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
        await this.deleteFileInS3Recursively(params);
      }
    } catch (error) {
      // TODO (developer) - Handle exception
      throw error;
    }
  }

  /**
   * Multipart Upload
   */
  async createMultipartUpload(params: {bucket: string; key: string}) {
    const {key, bucket} = params;
    const command = new CreateMultipartUploadCommand({
      Key: key,
      Bucket: bucket,
    });

    return await this.client.send(command);
  }

  async uploadPart(params: {
    key: string;
    bucket: string;
    uploadId: string;
    partNumber: number;
    body: Buffer | Uint8Array | Blob | string;
  }) {
    const {key, bucket, uploadId, partNumber, body} = params;
    const command = new UploadPartCommand({
      Key: key,
      Body: body,
      Bucket: bucket,
      UploadId: uploadId,
      PartNumber: partNumber,
    });
    const response = await this.client.send(command);

    return {
      ETag: response.ETag,
      PartNumber: partNumber,
    };
  }

  async generatePresignedUrlForPartUpload(params: {
    key: string;
    bucket: string;
    uploadId: string;
    partNumber: number;
  }) {
    const {key, bucket, uploadId, partNumber} = params;
    const command = new UploadPartCommand({
      Key: key,
      Bucket: bucket,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresIn,
    });
  }

  async completeMultipartUpload(params: {
    key: string;
    bucket: string;
    uploadId: string;
    parts: {ETag: string; PartNumber: number}[];
  }) {
    const {key, bucket, uploadId, parts} = params;
    const command = new CompleteMultipartUploadCommand({
      Key: key,
      Bucket: bucket,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    return await this.client.send(command);
  }

  async abortMultipartUpload(params: {
    key: string;
    bucket: string;
    uploadId: string;
  }) {
    const {key, bucket, uploadId} = params;
    const command = new AbortMultipartUploadCommand({
      Key: key,
      Bucket: bucket,
      UploadId: uploadId,
    });

    return await this.client.send(command);
  }
}
