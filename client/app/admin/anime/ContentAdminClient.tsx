"use client";

import { useState } from "react";
import { Download, Edit, Eye, Plus, Save, Search, Star, Trash2, Tv } from "lucide-react";
import { FileVideo } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, ChapterManager, ConfirmDialog, Content, CONTENT_SEED, emptyContent, EpisodeManager, Field, GhostBtn, Modal, PrimaryBtn, SBdg, inputCls, isVideoType } from "../modules/AdminModules";

export default function ContentMgmt({ type }: { type: string }) {
  const labels: Record<string, string> = { anime: "Anime", phim: "Phim live-action", manga: "Manga", novel: "Tiểu thuyết" };
  const [rows, setRows] = useState<Content[]>(CONTENT_SEED);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sel, setSel] = useState<number[]>([]);
  const [editing, setEditing] = useState<Content | null>(null);
  const [viewing, setViewing] = useState<Content | null>(null);
  const [confirmDel, setConfirmDel] = useState<Content | null>(null);
  const [form, setForm] = useState<Content>(emptyContent(type));

  const filtered = rows.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) &&
    (statusFilter === "all" || r.status === statusFilter)
  );

  const openAdd = () => { setForm(emptyContent(type)); setEditing(emptyContent(type)); };
  const openEdit = (r: Content) => { setForm(r); setEditing(r); };
  const save = () => {
    if (!form.title.trim()) { toast.error("Vui lòng nhập tiêu đề"); return; }
    if (form.id === 0) {
      const id = Math.max(0, ...rows.map(r => r.id)) + 1;
      setRows([{ ...form, id, tags: form.tags }, ...rows]);
      toast.success(`Đã thêm "${form.title}"`);
    } else {
      setRows(rows.map(r => r.id === form.id ? form : r));
      toast.success(`Đã cập nhật "${form.title}"`);
    }
    setEditing(null);
  };
  const del = (r: Content) => { setRows(rows.filter(x => x.id !== r.id)); setSel(s => s.filter(x => x !== r.id)); setConfirmDel(null); toast.success(`Đã xoá "${r.title}"`); };
  const bulkDelete = () => { setRows(rows.filter(r => !sel.includes(r.id))); toast.success(`Đã xoá ${sel.length} mục`); setSel([]); };
  const exportCsv = () => {
    const head = "Tiêu đề,Studio,Năm,Tập,Trạng thái,Điểm,Lượt xem";
    const body = filtered.map(r => `${r.title},${r.studio},${r.year},${r.ep},${r.status},${r.score},${r.views}`).join("\n");
    const url = URL.createObjectURL(new Blob([head + "\n" + body], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${type}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("Đã xuất CSV");
  };
  const allSel = filtered.length > 0 && filtered.every(r => sel.includes(r.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Tìm kiếm ${labels[type] ?? type}...`}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className=" border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none">
          <option value="all">Tất cả trạng thái</option><option>Đang chiếu</option><option>Đã hoàn thành</option><option>Sắp ra mắt</option>
        </select>
        <GhostBtn icon={Download} onClick={exportCsv}>Xuất CSV</GhostBtn>
        <PrimaryBtn icon={Plus} onClick={openAdd}>Thêm mới</PrimaryBtn>
      </div>

      {sel.length > 0 && (
        <Card className="flex items-center gap-3 px-4 py-3">
          <span className="text-sm text-white/70">Đã chọn {sel.length} mục</span>
          <button onClick={bulkDelete} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs hover:bg-rose-500/30 transition"><Trash2 className="w-3.5 h-3.5" /> Xoá đã chọn</button>
          <button onClick={() => setSel([])} className="text-xs text-white/40 hover:text-white transition">Bỏ chọn</button>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.08]">
              <th className="p-4 text-left"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? [] : filtered.map(r => r.id))} className="rounded" /></th>
              {["TIÊU ĐỀ", "STUDIO", "NĂM", "TẬP", "TRẠNG THÁI", "ĐIỂM", "LƯỢT XEM", ""].map((h, i) => (
                <th key={i} className={`p-4 text-white/40 font-medium text-xs ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4"><input type="checkbox" checked={sel.includes(r.id)} onChange={() => setSel(s => s.includes(r.id) ? s.filter(x => x !== r.id) : [...s, r.id])} className="rounded" /></td>
                  <td className="p-4"><div className="font-medium text-white">{r.title}</div><div className="flex gap-1 mt-1">{r.tags.map(t => <Bdg key={t}>{t}</Bdg>)}</div></td>
                  <td className="p-4 text-white/60">{r.studio || "—"}</td>
                  <td className="p-4 text-white/60">{r.year}</td>
                  <td className="p-4 text-white/60">{r.ep || "—"}</td>
                  <td className="p-4"><SBdg s={r.status} /></td>
                  <td className="p-4"><div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /><span className="text-white/80">{r.score || "—"}</span></div></td>
                  <td className="p-4 text-white/60">{r.views}</td>
                  <td className="p-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition"><Btn icon={Eye} onClick={() => setViewing(r)} /><Btn icon={Edit} color="a" onClick={() => openEdit(r)} /><Btn icon={Trash2} color="r" onClick={() => setConfirmDel(r)} /></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-white/30 text-sm">Không tìm thấy kết quả</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08]">
          <span className="text-xs text-white/40">Hiển thị {filtered.length} kết quả</span>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={form.id === 0 ? `Thêm ${labels[type] ?? type}` : "Chỉnh sửa nội dung"} wide
        footer={<><GhostBtn onClick={() => setEditing(null)}>Huỷ</GhostBtn><PrimaryBtn icon={Save} onClick={save}>Lưu</PrimaryBtn></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <div className="sm:col-span-2"><Field label="Tiêu đề *"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Tên tác phẩm" /></Field></div>
          <Field label="Studio"><input className={inputCls} value={form.studio} onChange={e => setForm({ ...form, studio: e.target.value })} /></Field>
          <Field label="Năm"><input type="number" className={inputCls} value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} /></Field>
          <Field label={isVideoType(type) ? "Số tập (tự động)" : "Số chương (tự động)"}><input readOnly className={`${inputCls} opacity-60 cursor-default`} value={isVideoType(type) ? (form.episodes?.length ?? 0) : (form.chapters?.length ?? 0)} /></Field>
          <Field label="Điểm"><input type="number" step="0.1" className={inputCls} value={form.score} onChange={e => setForm({ ...form, score: +e.target.value })} /></Field>
          <Field label="Trạng thái"><select className={inputCls} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Đang chiếu</option><option>Đã hoàn thành</option><option>Sắp ra mắt</option></select></Field>
          <Field label="Lượt xem"><input className={inputCls} value={form.views} onChange={e => setForm({ ...form, views: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Thể loại (phân cách bằng dấu phẩy)"><input className={inputCls} value={form.tags.join(", ")} onChange={e => setForm({ ...form, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} placeholder="Action, Fantasy" /></Field></div>
          <div className="sm:col-span-2 border-t border-white/[0.08] pt-4 mt-1 mb-3">
            <div className="text-sm font-medium text-white mb-1">{isVideoType(type) ? "Quản lý tập phim" : "Quản lý chương"}</div>
            <div className="text-xs text-white/40">{isVideoType(type) ? "Mỗi tập có video riêng, sắp xếp và đăng độc lập." : "Mỗi chương quản lý số trang và trạng thái đăng."}</div>
          </div>
          {isVideoType(type)
            ? <EpisodeManager episodes={form.episodes ?? []} onChange={eps => setForm({ ...form, episodes: eps, ep: eps.length })} />
            : <ChapterManager chapters={form.chapters ?? []} onChange={chs => setForm({ ...form, chapters: chs, ep: chs.length })} />}
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Chi tiết nội dung">
        {viewing && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-4"><div className="w-20 h-28 rounded-lg bg-white/10 shrink-0 flex items-center justify-center"><Tv className="w-7 h-7 text-white/30" /></div>
              <div><div className="text-white font-semibold text-base">{viewing.title}</div><div className="text-white/50 mt-1">{viewing.studio} · {viewing.year}</div><div className="mt-2"><SBdg s={viewing.status} /></div></div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              {[["Số tập", viewing.ep || "—"], ["Điểm", viewing.score || "—"], ["Lượt xem", viewing.views]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-white/[0.04] p-3 text-center"><div className="text-white font-semibold">{v}</div><div className="text-xs text-white/40 mt-0.5">{l}</div></div>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap pt-1">{viewing.tags.map(t => <Bdg key={t}>{t}</Bdg>)}</div>
            {isVideoType(viewing.type) && (viewing.episodes?.length ?? 0) > 0 && (
              <div className="pt-2">
                <div className="text-xs text-white/50 mb-1.5">Danh sách tập ({viewing.episodes!.length})</div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {viewing.episodes!.map(ep => (
                    <div key={ep.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="w-6 text-center text-xs font-semibold text-[#f4536b]">{ep.num}</span>
                      <span className="flex-1 text-white/80 truncate">{ep.title || `Tập ${ep.num}`}</span>
                      <span className="text-xs text-white/30">{ep.duration}</span>
                      {ep.videoName && <FileVideo className="w-3.5 h-3.5 text-white/30" />}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ep.published ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/40"}`}>{ep.published ? "Đã đăng" : "Nháp"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isVideoType(viewing.type) && (viewing.chapters?.length ?? 0) > 0 && (
              <div className="pt-2">
                <div className="text-xs text-white/50 mb-1.5">Danh sách chương ({viewing.chapters!.length})</div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  {viewing.chapters!.map(ch => (
                    <div key={ch.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="w-6 text-center text-xs font-semibold text-[#d4a648]">{ch.num}</span>
                      <span className="flex-1 text-white/80 truncate">{ch.title || `Chương ${ch.num}`}</span>
                      <span className="text-xs text-white/30">{ch.pages || 0} trang</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ch.published ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-white/40"}`}>{ch.published ? "Đã đăng" : "Nháp"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog item={confirmDel} onCancel={() => setConfirmDel(null)} onConfirm={() => confirmDel && del(confirmDel)}
        title="Xoá nội dung?" desc={confirmDel ? `Bạn có chắc muốn xoá "${confirmDel.title}"? Hành động này không thể hoàn tác.` : ""} />
    </div>
  );
}


