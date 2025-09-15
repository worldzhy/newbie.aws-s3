import {
  Get,
  Body,
  Post,
  Param,
  Patch,
  Query,
  Delete,
  Controller,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CreateFileRequestDto,
  CreateFolderRequestDto,
  ListFilePathsResDto,
  ListFilesRequestDto,
  ListFilesResponseDto,
  RenameFileRequestDto,
  UploadBase64RequestDto,
  UploadFileRequestDto,
  CreateMultipartUploadResponseDto,
  CreateMultipartUploadRequestDto,
  UploadPartRequestDto,
  UploadPartResponseDto,
  CompleteMultipartUploadRequestDto,
  AbortMultipartUploadRequestDto,
  RenameFileResponseDto,
  MoveFileRequestDto,
} from './aws-s3-file.dto';
import {Prisma} from '@prisma/client';
import {AwsS3FileService} from './aws-s3-file.service';
import {FileInterceptor} from '@nestjs/platform-express';
import {PrismaService} from '@framework/prisma/prisma.service';

@ApiTags('AWS / S3')
@ApiBearerAuth()
@Controller('aws-s3/files')
export class AwsS3FileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3File: AwsS3FileService
  ) {}

  //*******************/
  //* File operations */
  //*******************/

  @Get('sync')
  @ApiOperation({summary: 'Sync files from S3 to database'})
  async syncFiles() {
    await this.s3File.syncFilesFromS3ToDatabase();
  }

  @Get('')
  @ApiResponse({
    type: ListFilesResponseDto,
  })
  async listFiles(@Query() query: ListFilesRequestDto) {
    return await this.prisma.findManyInManyPages({
      model: Prisma.ModelName.S3File,
      pagination: {page: query.page, pageSize: query.pageSize},
      findManyArgs: {
        where: {parentId: query.parentId ?? null},
        orderBy: {name: 'asc'},
      },
    });
  }

  @Post('folders')
  @ApiOperation({
    summary: 'Create a folder in AWS S3',
    description: 'Create a folder in AWS S3',
  })
  async createFolder(@Body() body: CreateFolderRequestDto) {
    return await this.s3File.createFolder({
      path: body.name,
      parentId: body.parentId,
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

  @Patch(':fileId/rename')
  @ApiResponse({type: RenameFileResponseDto})
  async renameFile(
    @Param('fileId') fileId: string,
    @Body() body: RenameFileRequestDto
  ) {
    return await this.prisma.s3File.update({
      where: {id: fileId},
      data: {name: body.name},
    });
  }

  @Patch(':fileId/move')
  async moveFile(
    @Param('fileId') fileId: string,
    @Body() body: MoveFileRequestDto
  ) {
    return await this.s3File.moveFileOrFolder({
      fileId,
      destinationParentId: body.destinationParentId,
    });
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    return await this.s3File.deleteFile(id);
  }

  @Post('signedUploadUrl')
  async getSignedUploadUrl(@Body() body: CreateFileRequestDto) {
    return await this.s3File.getSignedUploadUrl(body);
  }

  @Get('signedDownloadUrl')
  async getSignedDownloadUrl(@Query('fileId') fileId: string) {
    return await this.s3File.getSignedDownloadUrl(fileId);
  }

  //*********************/
  //* Upload operations */
  //*********************/

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // Receive file
  async uploadFile(
    @Body() body: UploadFileRequestDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return await this.s3File.uploadFile({
      buffer: file.buffer,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      ...body,
    });
  }

  @Post('upload-base64')
  async uploadBase64(@Body() body: UploadBase64RequestDto) {
    const {base64, ...others} = body;

    // Convert base64 to buffer
    const base64Data = base64.replace(/^data:([\w\/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Extract mimetype from base64 string
    const mimetypeMatch = base64.match(/^data:([\w\/]+);base64,/);
    const mimetype = mimetypeMatch ? mimetypeMatch[1] : '';

    return await this.s3File.uploadFile({
      buffer: buffer,
      type: mimetype,
      size: buffer.length,
      ...others,
    });
  }

  //*******************************/
  //* Multipart upload operations */
  //*******************************/

  @Post('create-multipart')
  @ApiResponse({type: CreateMultipartUploadResponseDto})
  async createMultipartUpload(@Body() body: CreateMultipartUploadRequestDto) {
    return await this.s3File.createMultipartUpload(body);
  }

  @Post('upload-part')
  @ApiResponse({type: UploadPartResponseDto})
  @UseInterceptors(
    FileInterceptor('chunk', {limits: {fileSize: 6 * 1024 * 1024}})
  )
  async uploadPart(
    @Body() body: UploadPartRequestDto,
    @UploadedFile() chunk: Express.Multer.File
  ) {
    return await this.s3File.uploadPart({body: chunk.buffer, ...body});
  }

  @Post('complete-multipart')
  async completeMultipartUpload(
    @Body() body: CompleteMultipartUploadRequestDto
  ) {
    return await this.s3File.completeMultipartUpload(body);
  }

  @Post('abort-multipart')
  async abortMultipartUpload(@Body() body: AbortMultipartUploadRequestDto) {
    return await this.s3File.abortMultipartUpload(body.uploadId);
  }

  /* End */
}
