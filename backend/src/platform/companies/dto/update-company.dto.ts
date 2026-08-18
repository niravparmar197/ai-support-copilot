import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

// No status field, deliberately — see Q2 in the accompanying answer.
// Status transitions only happen through the dedicated suspend/activate
// endpoints, which get their own audit actions distinct from
// "company.updated". If a client sends `status` anyway, the global
// ValidationPipe's whitelist strips it before it ever reaches the service
// (see the "edit does not accept a status field" test).
export class UpdateCompanyDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  companyName: string;
}
