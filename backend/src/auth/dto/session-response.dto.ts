import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description: 'Rough browser/OS label parsed from the User-Agent header.',
  })
  label: string;

  @ApiProperty({ nullable: true, type: String })
  ip: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({
    description:
      'Whether this is the session the current request is authenticated with.',
  })
  isCurrent: boolean;
}
