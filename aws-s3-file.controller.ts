import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiBody} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import {AwsS3FileService} from './aws-s3-file.service';
import {createFolderDto} from './aws-s3-file.dto';

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
  async createFolder(@Body() body: createFolderDto) {
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

  @Post('uploadFile')
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
    @Body()
    body: {
      folderId?: string; // Do not use both `folderId` and `path` at the same time
      path?: string; // The folder path to upload the file, e.g. 'uploads', not including `/` at the end.
      overwrite?: boolean; // Default to false, do not overwrite existing files
      useOriginalName?: boolean; // Default to false, do not use the original file name
    },
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({fileType: 'pdf|doc|png|jpg|jpeg'})
        .build()
    )
    file: Express.Multer.File
  ) {
    await this.s3File.uploadFile({
      file: file,
      parentId: body.folderId,
      path: body.path,
      overwrite: body.overwrite,
      useOriginalName: body.useOriginalName,
    });
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.s3File.deleteFile(id);
  }

  /* End */
}
