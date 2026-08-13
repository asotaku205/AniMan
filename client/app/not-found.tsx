import Link from "next/link";
export default function NotFound() {
  return (
    <div className="h-screen w-screen grid place-items-center text-center px-6 ">
      <div>
        <div className="text-pink-300/70 tracking-[0.4em] text-xs uppercase">Lạc đường</div>
        <h1 style={{ fontFamily: "Bagel Fat One, serif" }} className="text-white text-7xl mt-4">404</h1>
        <p className="text-white/60 mt-4 max-w-md mx-auto">Trang bạn tìm đã rơi cùng những cánh hoa anh đào. Hãy quay về trang chủ.</p>
        <Link href="/" className="inline-block mt-6 px-5 h-11 leading-[44px] rounded-full bg-gradient-to-r from-pink-500 to-rose-400 text-white">Về trang chủ</Link>
      </div>
    </div>
  );
}