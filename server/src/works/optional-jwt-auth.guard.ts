import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard JWT tùy chọn cho endpoint file/ảnh bìa: tác phẩm đã duyệt ở
 * chế độ công khai phải xem được cả khi chưa đăng nhập (thẻ img/video
 * của trình duyệt không gắn được Authorization). Không có header
 * Authorization thì cho qua với viewer undefined, service sẽ tự
 * quyết định theo trạng thái duyệt và chế độ hiển thị. Có header thì
 * kiểm tra như JwtAuthGuard bình thường, token sai vẫn 401.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, unknown>;
    }>();
    const authorization = request.headers?.authorization;
    if (typeof authorization !== "string" || !authorization.trim()) {
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
