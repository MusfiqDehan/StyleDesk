import { TenantOwned } from '../../tenancy/owned.entity.js';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()

export class WhyChooseUsImage extends TenantOwned {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  image1: string;

  @Column({ nullable: true })
  image2: string;

  @Column({ nullable: true })
  image3: string;

  @Column({ nullable: true })
  image4: string;
}
