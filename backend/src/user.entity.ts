import { TenantOwned } from './tenancy/owned.entity.js';
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()

export class User extends TenantOwned {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    email: string;

    @Column()
    name: string;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}
