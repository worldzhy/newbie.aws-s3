import {
  CommonListRequestDto,
  CommonListResponseDto,
} from '@framework/common.dto';
import {ApiProperty} from '@nestjs/swagger';
import {IsOptional, IsString, MinLength} from 'class-validator';

export class FileEntity {
  @ApiProperty({type: String})
  id: string;

  @ApiProperty({type: String})
  name: string;

  @ApiProperty({type: String})
  type: string;

  @ApiProperty({
    type: Number,
    description: 'The size of the file in bytes, null for folders.',
  })
  size: number | null;

  @ApiProperty({type: String})
  s3Bucket: string;

  @ApiProperty({type: String})
  s3Key: string;

  @ApiProperty({type: Object})
  s3Response: any;

  @ApiProperty({type: String})
  parentId: string | null;

  @ApiProperty({type: String})
  createdAt: string;

  @ApiProperty({type: String})
  updatedAt: string;
}

export class ListFilesRequestDto extends CommonListRequestDto {
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

export class ListFilesResponseDto extends CommonListResponseDto {
  @ApiProperty({
    type: FileEntity,
    isArray: true,
    description: 'The last update timestamp.',
  })
  declare records: FileEntity[];
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
    type: String,
    required: false,
    description:
      'Base64 encoded file data. Use this when uploading file as base64 instead of multipart/form-data.',
  })
  @IsString()
  @IsOptional()
  base64?: string;

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

export class ListFilePathsResDto {
  @ApiProperty({
    type: String,
  })
  @IsString()
  id: string;

  @ApiProperty({
    type: String,
  })
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
  })
  @IsString()
  type: string;
  @ApiProperty({
    type: String,
  })
  @IsString()
  parentId: string;
}
