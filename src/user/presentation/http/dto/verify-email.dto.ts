import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  workflowId!: string;

  @IsString()
  token!: string;
}
