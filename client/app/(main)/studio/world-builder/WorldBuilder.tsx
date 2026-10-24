"use client";

/**
 * World Builder — từ W1, màn hình chính là SA BÀN 3D (thay hẳn bản đồ
 * hex cũ, theo quyết định Sơn chốt 23/10). Bố cục hướng A đã duyệt:
 * cột trái thư viện mẫu + câu chuyện, giữa là sa bàn, phải là hồ sơ
 * của vật đang chọn. Các component bản đồ hex cũ còn nằm trên đĩa
 * nhưng không còn được dùng — dọn sau khi W1 ổn định.
 */

import { DioramaWorkspace } from "./components/DioramaWorkspace";

export function WorldBuilder() {
  return <DioramaWorkspace />;
}
