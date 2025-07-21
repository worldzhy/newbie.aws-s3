import {CommonPaginationReqDto} from '@framework/common.dto';
import {ApiProperty} from '@nestjs/swagger';
import {IsOptional, IsString, MinLength} from 'class-validator';

export class ListFilesDto extends CommonPaginationReqDto {
  @ApiProperty({
    type: String,
    required: false,
    description:
      'The folder ID to list files in, if not provided, lists root files.',
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class CreateFolderDto {
  @ApiProperty({
    type: String,
    required: true,
    description: 'The name of the folder to create.',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'The parent folder ID to create the folder in.',
  })
  @IsString()
  @IsOptional()
  parentId?: string;
}

export class CreateFileDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  originalname: string;

  @ApiProperty({type: String, required: true})
  @IsString()
  mimetype: string;

  @ApiProperty({type: Number, required: true})
  size: number;

  @ApiProperty({
    type: String,
    required: false,
    description:
      'The folder ID to create the file in, do not use both `parentId` and `path` at the same time.',
  })
  @IsString()
  @IsOptional()
  parentId?: string; // Do not use both `parentId` and `path`

  @ApiProperty({
    type: String,
    required: false,
    description:
      'The folder path to upload the file, e.g. "uploads", not including "/" at the end.',
  })
  @IsString()
  @IsOptional()
  path?: string;
}

export class RenameFileDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  name: string;
}

export class UploadFileDto {
  @ApiProperty({
    type: String,
    required: false,
    description:
      'The parent folder ID to upload the file to, do not use both `parentId` and `path` at the same time.',
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      'The folder path to upload the file, e.g. "uploads", not including "/" at the end.',
  })
  @IsString()
  @IsOptional()
  path?: string;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      'Whether to overwrite the file if it already exists. Do not overwrite the existing file if not specified.',
  })
  @IsOptional()
  overwrite?: boolean;

  @ApiProperty({
    type: Boolean,
    required: false,
    description:
      'Whether to use the original file name when uploading. Use original name if not specified.',
  })
  @IsOptional()
  useOriginalName?: boolean;
}
