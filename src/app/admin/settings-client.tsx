'use client';

import { useEffect, useMemo, useState } from 'react';

type Group = { key: string; label: string };
type Field = { key: string; label: string; secret: boolean; group: string; configured: boolean; value: string; hint: string };
type Pack = { id: string; name: string; credits: number; priceCents: number; currency: string; active: boolean; sortOrder: number };
type Rule = { id?: string; model: string; resolution: string; creditsPerSecond: number };

const inputClass = 'mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#7036F0]';

export default function AdminSettingsClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/settings').then((r) => r.json()),
      fetch('/api/admin/catalog').then((r) => r.json()),
    ]).then(([settings, catalog]) => {
      setGroups(settings.groups || []);
      setFields(settings.fields || []);
      setPacks(catalog.packs || []);
      setRules(catalog.rules || []);
    });
  }, []);

  const groupedFields = useMemo(() => new Map(groups.map((group) => [group.key, fields.filter((field) => field.group === group.key)])), [groups, fields]);

  async function save() {
    const values = Object.fromEntries(fields.map((field) => [field.key, field.value]));
    const [settingsResponse, catalogResponse] = await Promise.all([
      fetch('/api/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ values }) }),
      fetch('/api/admin/catalog', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ packs, rules }) }),
    ]);
    setMessage(settingsResponse.ok && catalogResponse.ok ? '配置已保存' : '保存失败');
  }

  function updateField(key: string, value: string) {
    setFields((current) => current.map((field) => field.key === key ? { ...field, value } : field));
  }

  return (
    <main className="min-h-screen bg-[#131416] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">管理端设置</h1>
            <p className="mt-1 text-sm text-white/50">供应商模型 ID 已内置，后台只填写连接信息和业务价格。</p>
          </div>
          <button onClick={save} className="rounded-lg bg-[#7036F0] px-4 py-2 font-semibold">保存全部</button>
        </div>

        <div className="mt-8 space-y-5">
          {groups.map((group) => {
            const groupFields = groupedFields.get(group.key) || [];
            if (!groupFields.length) return null;
            return (
              <section key={group.key} className="rounded-2xl border border-white/10 bg-[#1c1e21] p-5">
                <h2 className="text-xl font-semibold">{group.label}</h2>
                {group.key === 'openai' && <p className="mt-1 text-sm text-white/50">脚本模型和 GPT-image-2 共用下面这组 OpenAI 兼容接口；模型 ID 已内置。</p>}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {groupFields.map((field) => (
                    <label key={field.key} className="text-sm text-white/80">
                      {field.label}
                      {field.secret && field.configured && <span className="ml-2 text-xs text-emerald-300">{field.hint}</span>}
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={field.value}
                        placeholder={field.secret && field.configured ? '留空保持不变' : ''}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        className={inputClass}
                      />
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#1c1e21] p-5">
          <h2 className="text-xl font-semibold">套餐配置</h2>
          <p className="mt-1 text-sm text-white/50">配置用户购买的积分套餐，价格单位为人民币元。</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-white/45">
                <tr><th className="px-2 py-2">套餐 ID</th><th className="px-2 py-2">套餐名称</th><th className="px-2 py-2">积分数量</th><th className="px-2 py-2">价格（元）</th><th className="px-2 py-2">排序</th></tr>
              </thead>
              <tbody>
                {packs.map((pack, index) => (
                  <tr key={pack.id} className="border-b border-white/5">
                    <td className="px-2 py-2"><input value={pack.id} disabled className="w-full rounded bg-white/5 px-2 py-2 text-white/50" /></td>
                    <td className="px-2 py-2"><input value={pack.name} onChange={(e) => setPacks((all) => all.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="w-full rounded bg-white/5 px-2 py-2" /></td>
                    <td className="px-2 py-2"><input type="number" min="0" value={pack.credits} onChange={(e) => setPacks((all) => all.map((item, i) => i === index ? { ...item, credits: Number(e.target.value) } : item))} className="w-full rounded bg-white/5 px-2 py-2" /></td>
                    <td className="px-2 py-2"><input type="number" min="0" step="0.01" value={pack.priceCents / 100} onChange={(e) => setPacks((all) => all.map((item, i) => i === index ? { ...item, priceCents: Math.round(Number(e.target.value) * 100) } : item))} className="w-full rounded bg-white/5 px-2 py-2" /></td>
                    <td className="px-2 py-2"><input type="number" value={pack.sortOrder} onChange={(e) => setPacks((all) => all.map((item, i) => i === index ? { ...item, sortOrder: Number(e.target.value) } : item))} className="w-full rounded bg-white/5 px-2 py-2" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-white/10 bg-[#1c1e21] p-5">
          <h2 className="text-xl font-semibold">视频生成费用配置</h2>
          <p className="mt-1 text-sm text-white/50">模型和分辨率由系统固定；这里只调整每秒积分。实际费用 = 向上取整（每秒积分 × 视频秒数）。</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-white/45">
                <tr><th className="px-2 py-2">Seedance 模型</th><th className="px-2 py-2">分辨率</th><th className="px-2 py-2">每秒积分</th></tr>
              </thead>
              <tbody>
                {rules.map((rule, index) => (
                  <tr key={rule.id || `${rule.model}-${rule.resolution}`} className="border-b border-white/5">
                    <td className="px-2 py-2"><input value={rule.model} readOnly className="w-full rounded bg-white/[0.03] px-2 py-2 text-white/50" /></td>
                    <td className="px-2 py-2"><input value={rule.resolution} readOnly className="w-full rounded bg-white/[0.03] px-2 py-2 text-white/50" /></td>
                    <td className="px-2 py-2"><input type="number" min="0.01" step="0.01" value={rule.creditsPerSecond} onChange={(e) => setRules((all) => all.map((item, i) => i === index ? { ...item, creditsPerSecond: Number(e.target.value) } : item))} className="w-full rounded bg-white/5 px-2 py-2" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {message && <p className="fixed bottom-5 right-5 rounded-lg bg-emerald-700 px-4 py-2 text-sm">{message}</p>}
      </div>
    </main>
  );
}
