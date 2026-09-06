"use client";

import { useState } from "react";
import { Edit, GripVertical, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, CAT_TYPES, ConfirmDialog, Field, GhostBtn, ImageUpload, inputCls, Modal, PrimaryBtn, SBdg, Toggle, Category, CATEGORY_SEED, COLOR_CHOICES, catTypeLabel, emptyCat, slugify, SON } from "../modules/AdminModules";

export default function CategoriesMgmt() {
  const [rows, setRows] = useState<Category[]>(CATEGORY_SEED);
  const [tab, setTab] = useState("genre");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<Category>(emptyCat("genre"));
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);

  const filtered = rows.filter(c => c.type === tab && c.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => { setForm(emptyCat(tab)); setSlugTouched(false); setEditing(emptyCat(tab)); };
  const openEdit = (c: Category) => { setForm(c); setSlugTouched(true); setEditing(c); };
  const setName = (name: string) => setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  const save = () => {
    if (!form.name.trim()) { toast.error("Vui lòng nhập tên danh mục"); return; }
    const slug = form.slug.trim() || slugify(form.name);
    const dup = rows.find(c => c.type === form.type && c.slug === slug && c.id !== form.id);
    if (dup) { toast.error(`Slug "${slug}" đã tồn tại`); return; }
    if (form.id === 0) {
      setRows([{ ...form, slug, id: Math.max(0, ...rows.map(r => r.id)) + 1 }, ...rows]);
      toast.success(`Đã thêm danh mục "${form.name}"`);
    } else {
      setRows(rows.map(r => r.id === form.id ? { ...form, slug } : r));
      toast.success(`Đã cập nhật "${form.name}"`);
    }
    setEditing(null);
  };
  const toggleActive = (c: Category) => { setRows(rows.map(r => r.id === c.id ? { ...r, active: !r.active } : r)); toast.success(c.active ? `Đã ẩn "${c.name}"` : `Đã hiện "${c.name}"`); };
  const del = (c: Category) => { setRows(rows.filter(r => r.id !== c.id)); setConfirmDel(null); toast.success(`Đã xoá "${c.name}"`); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {CAT_TYPES.map(t => (
          <Card key={t.key} className="p-4 text-center">
            <div className="text-2xl font-bold text-white">{rows.filter(c => c.type === t.key).length}</div>
            <div className="text-xs text-white/40 mt-1">{t.label}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {CAT_TYPES.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-xl text-sm transition ${tab === t.key ? "text-white font-medium" : "bg-white/[0.04] border border-white/10 text-white/60 hover:text-white hover:border-white/20"}`} style={tab === t.key ? SON : {}}>{t.label}</button>
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm danh mục..." className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#d72638]/50" />
        </div>
        <PrimaryBtn icon={Plus} onClick={openAdd}>Thêm danh mục</PrimaryBtn>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.08]">
              {["", "TÊN", "SLUG", "MÔ TẢ", "SỐ MỤC", "HIỂN THỊ", ""].map((h, i) => (
                <th key={i} className={`p-4 text-white/40 font-medium text-xs ${i === 6 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="p-4 w-6"><GripVertical className="w-4 h-4 text-white/15 cursor-grab" /></td>
                  <td className="p-4"><Bdg c={c.color}>{c.name}</Bdg></td>
                  <td className="p-4 text-white/50 font-mono text-xs">{c.slug}</td>
                  <td className="p-4 text-white/50 text-xs max-w-[280px]"><span className="line-clamp-1">{c.desc || "—"}</span></td>
                  <td className="p-4 text-white/70">{c.count.toLocaleString()}</td>
                  <td className="p-4"><Toggle on={c.active} onChange={() => toggleActive(c)} /></td>
                  <td className="p-4"><div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition"><Btn icon={Edit} color="a" onClick={() => openEdit(c)} /><Btn icon={Trash2} color="r" onClick={() => setConfirmDel(c)} /></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-white/30 text-sm">Chưa có danh mục nào</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.08] text-xs text-white/40">Hiển thị {filtered.length} {catTypeLabel(tab).toLowerCase()}</div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={form.id === 0 ? `Thêm ${catTypeLabel(form.type).toLowerCase()}` : "Chỉnh sửa danh mục"}
        footer={<><GhostBtn onClick={() => setEditing(null)}>Huỷ</GhostBtn><PrimaryBtn icon={Save} onClick={save}>Lưu</PrimaryBtn></>}>
        <Field label="Loại"><select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{CAT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Tên *"><input className={inputCls} value={form.name} onChange={e => setName(e.target.value)} placeholder="VD: Hành động" /></Field>
          <Field label="Slug"><input className={inputCls} value={form.slug} onChange={e => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} placeholder="tự tạo từ tên" /></Field>
        </div>
        <Field label="Mô tả"><textarea rows={2} className={inputCls} value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} placeholder="Mô tả ngắn về danh mục" /></Field>
        <div className="max-w-[240px]"><ImageUpload label="Ảnh bìa danh mục" value={form.cover || ""} onChange={v => setForm({ ...form, cover: v })} ratio="aspect-video" hint="Tỉ lệ 16:9 · ≤5MB" /></div>
        <Field label="Màu nhãn">
          <div className="flex gap-2 flex-wrap">
            {COLOR_CHOICES.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} className={`rounded-lg transition ${form.color === c ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#100a1d]" : ""}`}>
                <Bdg c={c}>{c}</Bdg>
              </button>
            ))}
          </div>
        </Field>
        <div className="flex items-center justify-between pt-1"><span className="text-sm text-white/70">Hiển thị công khai</span><Toggle on={form.active} onChange={() => setForm({ ...form, active: !form.active })} /></div>
      </Modal>

      <ConfirmDialog item={confirmDel} onCancel={() => setConfirmDel(null)} onConfirm={() => confirmDel && del(confirmDel)}
        title="Xoá danh mục?" desc={confirmDel ? `Xoá "${confirmDel.name}"? ${confirmDel.count} mục đang gắn danh mục này sẽ mất liên kết.` : ""} />
    </div>
  );
}


