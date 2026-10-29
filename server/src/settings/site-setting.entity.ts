import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/**
 * Mot khoa cai dat he thong (Lat 4). Chi 2 khoa duoc chap nhan:
 * "maintenance" va "registrationOpen", gia tri luu dang chuoi "true"/"false".
 */
@Entity({ name: "site_settings" })
export class SiteSetting {
  @PrimaryColumn("text")
  key!: string;

  @Column("text")
  value!: string;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
