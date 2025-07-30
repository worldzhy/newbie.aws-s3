import {
  CommonListRequestDto,
  CommonListResponseDto,
} from '@framework/common.dto';
import {ApiProperty} from '@nestjs/swagger';
import {IsOptional, IsString, MinLength} from 'class-validator';

export class ListFilesDto extends CommonListRequestDto {
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

export class ListFilesRes {
  @ApiProperty({
    type: String,
    description: 'The unique identifier of the file or folder.',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'The name of the file or folder.',
  })
  name: string;

  @ApiProperty({
    type: String,
    description: 'The type of the item, e.g., "folder" or file type.',
  })
  type: string;

  @ApiProperty({
    type: Number,
    required: false,
    description: 'The size of the file in bytes, null for folders.',
  })
  size: number | null;

  @ApiProperty({
    type: String,
    description: 'The S3 bucket name where the file is stored.',
  })
  s3Bucket: string;

  @ApiProperty({
    type: String,
    description: 'The S3 key (path) of the file in the bucket.',
  })
  s3Key: string;

  @ApiProperty({
    type: Object,
    required: false,
    description: 'The S3 response metadata from the upload operation.',
  })
  s3Response: any;

  @ApiProperty({
    type: String,
    required: false,
    description: 'The parent folder ID, null for root level items.',
  })
  parentId: string | null;

  @ApiProperty({
    type: String,
    description: 'The creation timestamp.',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    description: 'The last update timestamp.',
  })
  updatedAt: string;
}

export class ListFilesResDto {
  @ApiProperty({
    type: ListFilesRes,
    isArray: true,
    description: 'The last update timestamp.',
  })
  records: ListFilesRes[];

  @ApiProperty({
    type: CommonListResponseDto,
  })
  pagination: CommonListResponseDto;
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
