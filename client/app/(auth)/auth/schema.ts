import * as z from "zod";

export const signInSchema = z.object({
  username: z.string().min(1, "Tên đăng nhập không được để trống"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

export const signUpSchema = z
  .object({
    displayName: z.string().min(1, "Tên hiển thị không được để trống"),
    username: z
      .string()
      .min(1, "Tên đăng nhập không được để trống")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới",
      ),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z
      .string()
      .min(6, "Mật khẩu không khớp"),
    agree: z.literal(true, {
      errorMap: () => ({ message: "Bạn phải đồng ý với điều khoản dịch vụ" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu và xác nhận mật khẩu không khớp",
    path: ["confirmPassword"],
  });
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
