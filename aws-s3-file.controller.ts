import {Controller, Get, Post, Query} from '@nestjs/common';
import {ApiTags, ApiBearerAuth} from '@nestjs/swagger';
import {AwsS3FileService} from './aws-s3-file.service';

@ApiTags('AWS / S3')
@ApiBearerAuth()
@Controller('aws-s3')
export class AwsS3FileController {
  constructor(private readonly s3File: AwsS3FileService) {}

  @Post('signedUploadUrl')
  async getSignedUploadUrl(
    @Query('file')
    file: {originalname: string; mimetype: string; size: number},
    @Query('parentId') parentId?: string,
    @Query('path') path?: string
  ) {
    return await this.s3File.getSignedUploadUrl({file, parentId, path});
  }

  @Get('signedDownloadUrl')
  async getSignedDownloadUrl(@Query('fileId') fileId: string) {
    return await this.s3File.getSignedDownloadUrl(fileId);
  }

  /* End */
}
