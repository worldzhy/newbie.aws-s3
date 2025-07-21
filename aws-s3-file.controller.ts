import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {ApiTags, ApiBearerAuth, ApiBody} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import {AwsS3FileService} from './aws-s3-file.service';
import {
  CreateFileDto,
  CreateFolderDto,
  ListFilesDto,
  RenameFileDto,
  UploadFileDto,
} from './aws-s3-file.dto';
import {Prisma} from '@prisma/client';
import {PrismaService} from '@framework/prisma/prisma.service';

@ApiTags('AWS / S3')
@ApiBearerAuth()
@Controller('aws-s3/files')
export class AwsS3FileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3File: AwsS3FileService
  ) {}

  @Post('')
  async createFile(@Body() body: CreateFileDto) {
    return await this.s3File.createFile(body);
  }

  @Get('list')
  async listFiles(@Query() query: ListFilesDto) {
    return await this.prisma.findManyInManyPages({
      model: Prisma.ModelName.S3File,
      pagination: {page: query.page, pageSize: query.pageSize},
      findManyArgs: {where: {parentId: query.parentId ?? null}},
    });
  }

  @Post('upload')
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

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.s3File.deleteFile(id);
  }

  @Patch(':fileId/rename')
  async renameFile(
    @Param('fileId') fileId: string,
    @Body() body: RenameFileDto
  ) {
    return await this.prisma.s3File.update({
      where: {id: fileId},
      data: {name: body.name},
    });
  }

  @Get(':fileId/path')
  async getFilePath(@Param('fileId') fileId: string) {
    return await this.s3File.getFilePath(fileId);
  }

  @Get('signedDownloadUrl')
  async getSignedDownloadUrl(@Query('fileId') fileId: string) {
    return await this.s3File.getSignedDownloadUrl(fileId);
  }

  /* End */
}
