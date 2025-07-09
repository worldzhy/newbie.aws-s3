import {IsOptional, IsString, MinLength} from 'class-validator';

export class createFolderDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}
