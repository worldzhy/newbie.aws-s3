import {IsOptional, IsString, MinLength} from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UploadFileDto {
  @IsString()
  @IsOptional()
  parentId?: string; // Do not use both `parentId` and `path` at the same time

  @IsString()
  @IsOptional()
  path?: string; // The folder path to upload the file, e.g. 'uploads', not including `/` at the end.

  @IsOptional()
  overwrite?: boolean; // Default to false, do not overwrite existing files

  @IsOptional()
  useOriginalName?: boolean; // Default to false, do not use the original file name
}
