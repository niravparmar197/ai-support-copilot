import { ApiProperty } from '@nestjs/swagger';

// amount/totalAmount are strings, not numbers — Order.totalAmount and
// Payment.amount are Prisma Decimal (D-019: never Float for money), and
// this is what actually crosses the wire. Representing them as `number`
// here would invite exactly the "cast to number" mistake D-019 warns
// against at the first point a frontend consumer touches the value.
export class PaymentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: string;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true, type: String }) method: string | null;
  @ApiProperty() createdAt: Date;
}

export class OrderResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() totalAmount: string;
  @ApiProperty() status: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ type: [PaymentResponseDto] }) payments: PaymentResponseDto[];
}
