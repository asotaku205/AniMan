"use client";

import { useState } from "react";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bdg, Btn, Card, ConfirmDialog, Field, GhostBtn, inputCls, Modal, PrimaryBtn, Sched, SCHEDULE_SEED, emptySched } from "../modules/AdminModules";

export default function ScheduleMgmt() {
  const [rows, setRows] = useState<Sched[]>(SCHEDULE_SEED);
  const [editing, setEditing] = useState<Sched | null>(null);
  const [form, setForm] = useState<Sched>(emptySched());
  const [confirmDel, setConfirmDel] = useState<Sched | null>(null);
  const save = () => {
    if (!form.title.trim()) { toast.error("Nhập tiêu đề"); return; }
    if (form.id === 0) { setRows([...rows, { ...form, id: Math.max(0, ...rows.map(r => r.id)) + 1 }].sort((a, b) => a.time.localeCompare(b.time))); toast.success("Đã thêm lịch"); }
    else { setRows(rows.map(r => r.id === form.id ? form : r).sort((a, b) => a.time.localeCompare(b.time))); toast.success("Đã cập nhật lịch"); }
    setEditing(null);
  };
  const del = (s: Sched) => { setRows(rows.filter(x => x.id !== s.id)); setConfirmDel(null); toast.success("Đã xoá lịch"); };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <PrimaryBtn icon={Plus} onClick={() => { setForm(emptySched()); setEditing(emptySched()); }} className="ml-auto">Thêm lịch</PrimaryBtn>
      </div>
      <div className="space-y-3">
        {rows.map(s => (
          <Card key={s.id} className="p-4 hover:border-white/15 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-16 text-center shrink-0"><div className="text-lg font-bold text-[#d4a648]">{s.time}</div></div>
              <div className="w-px h-10 bg-white/10 shrink-0" />
              <div className="flex-1 min-w-0"><div className="font-medium text-white">{s.title}</div><div className="text-xs text-white/50 mt-0.5">{s.ep} · {s.day}</div></div>
              <Bdg c={s.type === "Anime" ? "pink" : "amber"}>{s.type}</Bdg>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"><Btn icon={Edit} color="a" onClick={() => { setForm(s); setEditing(s); }} /><Btn icon={Trash2} color="r" onClick={() => setConfirmDel(s)} /></div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={form.id === 0 ? "Thêm lịch phát sóng" : "Chỉnh sửa lịch"}
        footer={<><GhostBtn onClick={() => setEditing(null)}>Huỷ</GhostBtn><PrimaryBtn icon={Save} onClick={save}>Lưu</PrimaryBtn></>}>
        <Field label="Tiêu đề *"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Giờ"><input type="time" className={inputCls} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></Field>
          <Field label="Ngày"><input className={inputCls} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} placeholder="T2, CN..." /></Field>
        </div>
        <Field label="Tập"><input className={inputCls} value={form.ep} onChange={e => setForm({ ...form, ep: e.target.value })} placeholder="Tập 12" /></Field>
        <Field label="Loại"><select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Anime</option><option>Phim</option></select></Field>
      </Modal>
      <ConfirmDialog item={confirmDel} onCancel={() => setConfirmDel(null)} onConfirm={() => confirmDel && del(confirmDel)} title="Xoá lịch?" desc={confirmDel ? `Xoá lịch "${confirmDel.title}"?` : ""} />
    </div>
  );
}


