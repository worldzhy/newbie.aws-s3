import {
  IsArray,
  IsNumber,
  IsString,
  MinLength,
  IsOptional,
  IsObject,
} from 'class-validator';
import {
  CommonListRequestDto,
  CommonListResponseDto,
} from '@framework/common.dto';
import {ApiProperty} from '@nestjs/swagger';
import {FileEntity} from './aws-s3-file.entity';

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

export class CreateFolderRequestDto {
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

export class CreateFileRequestDto {
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

export class RenameFileRequestDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  name: string;
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

//***************/
//* Upload DTOs */
//***************/

export class UploadFileRequestDto {
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

export class UploadBase64RequestDto {
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
    required: true,
    description: 'Base64 encoded file data.',
  })
  @IsString()
  base64: string;

  @ApiProperty({
    type: String,
    required: true,
  })
  @IsString()
  originalname: string;

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

//*************************/
//* Multipart upload DTOs */
//*************************/
class UploadPartInfo {
  @ApiProperty({type: String, required: true})
  @IsString()
  ETag: string;

  @ApiProperty({type: Number, required: true})
  @IsNumber()
  PartNumber: number;
}

export class CreateMultipartUploadRequestDto extends CreateFileRequestDto {}

export class CreateMultipartUploadResponseDto {
  @ApiProperty({
    type: String,
    required: true,
  })
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    required: true,
  })
  @IsString()
  type: string;

  @ApiProperty({
    type: Number,
    required: true,
  })
  @IsNumber()
  size: string;

  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsOptional()
  fileId: string;

  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsOptional()
  path: string;

  @ApiProperty({
    type: String,
  })
  @IsString()
  @IsOptional()
  parentId: string;
}

export class UploadPartRequestDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  uploadId: string;

  @ApiProperty({type: Number, required: true})
  @IsNumber()
  uploadProgress: number;

  @ApiProperty({type: Number, required: true})
  @IsNumber()
  partNumber: number;
}

export class UploadPartResponseDto {
  @ApiProperty({type: String})
  @IsString()
  ETag: string;

  @ApiProperty({type: Number})
  @IsNumber()
  PartNumber: number;
}

export class CompleteMultipartUploadRequestDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  uploadId: string;

  @ApiProperty({
    type: UploadPartInfo,
    required: true,
  })
  @IsArray()
  parts: UploadPartInfo[];
}

export class AbortMultipartUploadRequestDto {
  @ApiProperty({type: String, required: true})
  @IsString()
  uploadId: string;
}
