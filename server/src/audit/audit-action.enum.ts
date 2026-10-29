/**
 * Cac hanh dong cua admin duoc ghi vao audit log (Lat 3, them Lat 4).
 *
 * 6 hanh dong duoc ghi. Gia tri chuoi on dinh, luu truc tiep vao cot
 * action va rang buoc bang CHECK constraint trong migration.
 */
export enum AuditAction {
  UserRoleChanged = "user.role_changed",
  UserSuspended = "user.suspended",
  UserUnsuspended = "user.unsuspended",
  WorkApproved = "work.approved",
  WorkRejected = "work.rejected",
  SettingsChanged = "settings_changed",
}
