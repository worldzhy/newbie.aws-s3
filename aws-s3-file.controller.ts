import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiBody} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import {AwsS3FileService} from './aws-s3-file.service';
import {CreateFolderDto, UploadFileDto} from './aws-s3-file.dto';

@ApiTags('AWS / S3')
@ApiBearerAuth()
@Controller('aws-s3/files')
export class AwsS3FileController {
  constructor(private readonly s3File: AwsS3FileService) {}

  @Post('folders')
  @ApiBody({
    description: 'Create a folder in AWS S3',
    examples: {
      a: {
        value: {
          name: 'uploads/images',
          parentId: '44f36b0b-2602-45d0-a2ed-b22085d1e845',
        },
      },
    },
  })
  async createFolder(@Body() body: CreateFolderDto) {
    return await this.s3File.createFolder(body);
  }

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

  @Post('upload')
  @ApiBody({
    description: 'Upload a file to AWS S3',
    examples: {
      a: {
        value: {
          parentFolderId: '44f36b0b-2602-45d0-a2ed-b22085d1e845',
          overwrite: false,
        },
      },
      b: {
        value: {
          path: 'uploads',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file')) // Receive file
  async uploadFile(
    @Body() body: UploadFileDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return await this.s3File.uploadFile({
      file: file,
      ...body,
    });
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.s3File.deleteFile(id);
  }

  /* End */
}
