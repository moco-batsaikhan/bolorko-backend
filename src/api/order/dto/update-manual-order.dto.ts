import { PartialType } from '@nestjs/swagger';
import { CreateManualOrderDto } from './create-manual-order.dto';

export class UpdateManualOrderDto extends PartialType(CreateManualOrderDto) {}
