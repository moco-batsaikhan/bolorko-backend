import { SetMetadata } from '@nestjs/common';
import { UserRoleEnum } from '../../api/user/entities/user-role.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRoleEnum[]) =>
  SetMetadata(ROLES_KEY, roles);
