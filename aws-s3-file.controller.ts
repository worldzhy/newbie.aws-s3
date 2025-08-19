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
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {FileInterceptor} from '@nestjs/platform-express';
import {AwsS3FileService} from './aws-s3-file.service';
import {
  CreateFileDto,
  CreateFolderDto,
  RenameFileDto,
  UploadFileDto,
  ListFilePathsResDto,
  ListFilesRequestDto,
  ListFilesResponseDto,
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

  @Get('')
  @ApiResponse({
    type: ListFilesResponseDto,
  })
  async listFiles(@Query() query: ListFilesRequestDto) {
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
    if (body.base64) {
      const {base64, ...otherBody} = body;
      const mimeTypeMatch = base64.match(/^data:([\w\/]+);base64,/);
      const mimetype = mimeTypeMatch ? mimeTypeMatch[1] : '';
      if (!mimetype) {
        throw new BadRequestException(
          'Invalid base64 data, no mimetype found, missing data:, e.g. [data:image/png;base64,]'
        );
      }
      const base64Data = base64.replace(/^data:([\w\/]+);base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const crypto = require('crypto');
      const hash = crypto
        .createHash('md5')
        .update(buffer)
        .digest('hex')
        .substring(0, 20);
      const fileExt = mimetype.split('/')[1] || '';
      if (!fileExt) {
        throw new BadRequestException(
          'Invalid base64 data, no fileExt found, missing data, e.g. [data:image/png;base64,]'
        );
      }
      const originalname = `${hash}.${fileExt}`;

      // create a Express.Multer.File structure
      const base64File = {
        buffer,
        originalname,
        mimetype,
        size: buffer.length,
        fieldname: 'base64',
        encoding: '7bit',
      };

      return await this.s3File.uploadFile({
        file: base64File as Express.Multer.File,
        ...otherBody,
        useOriginalName: false,
      });
    }
    return await this.s3File.uploadFile({
      file: file,
      ...body,
    });
  }

  @Post('folders')
  @ApiOperation({
    summary: 'Create a folder in AWS S3',
    description: 'Create a folder in AWS S3',
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
  @ApiResponse({
    type: ListFilePathsResDto,
    isArray: true,
  })
  async getFilePath(@Param('fileId') fileId: string) {
    return await this.s3File.getFilePath(fileId);
  }

  @Post('signedUploadUrl')
  async getSignedUploadUrl(@Body() body: CreateFileDto) {
    return await this.s3File.getSignedUploadUrl(body);
  }

  @Get('signedDownloadUrl')
  async getSignedDownloadUrl(@Query('fileId') fileId: string) {
    return await this.s3File.getSignedDownloadUrl(fileId);
  }

  /* End */
}
