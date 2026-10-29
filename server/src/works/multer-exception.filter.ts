import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from "@nestjs/common";
import { MulterError } from "multer";

/** Multer báo lỗi tải file thành HTTP có nghĩa thay vì 500. */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => {
        json: (body: Record<string, unknown>) => void;
      };
    }>();
    if (exception.code === "LIMIT_FILE_SIZE") {
      const error = new PayloadTooLargeException(
        "File exceeds the maximum allowed size.",
      );
      const status = error.getStatus();
      response.status(status).json({
        statusCode: status,
        message: error.message,
        error: "Payload Too Large",
      });
      return;
    }
    const error = new BadRequestException("Uploaded file was rejected.");
    const status = error.getStatus();
    response.status(status).json({
      statusCode: status,
      message: error.message,
      error: "Bad Request",
    });
  }
}
