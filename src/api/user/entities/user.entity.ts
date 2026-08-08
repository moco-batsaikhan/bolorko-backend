import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  password: string;

  @Column({ name: 'roleId', nullable: true })
  roleId: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @ManyToOne(() => UserRole, (role) => role.users, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role: UserRole;

  // Methods for profile updates
  updateProfile(name: string, phone: string): void {
    this.name = name;
    this.phone = phone;
  }

  changePassword(newHashedPassword: string): void {
    this.password = newHashedPassword;
  }

  updateRole(roleId: number): void {
    this.roleId = roleId;
  }
}
