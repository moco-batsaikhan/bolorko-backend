import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

export enum UserRoleEnum {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: UserRoleEnum,
    default: UserRoleEnum.USER,
  })
  role: UserRoleEnum;

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  // Helper methods
  addRole(role: UserRoleEnum): void {
    this.role = role;
  }

  deleteRole(): void {
    // Logic for role deletion
  }
}
