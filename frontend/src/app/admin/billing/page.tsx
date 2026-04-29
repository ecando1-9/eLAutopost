'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    CheckCircle2,
    Edit2,
    Loader2,
    PackageCheck,
    Plus,
    Save,
    Star,
    Tag,
    Trash2,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BillingPlan {
    id: string;
    plan_name: string;
    display_name: string;
    amount_paise: number;
    original_amount_paise: number | null;
    currency: string;
    billing_period_days: number;
    checkout_description: string | null;
    features: string[];
    sort_order: number;
    is_popular: boolean;
    is_active: boolean;
}

const EMPTY_PLAN: Omit<BillingPlan, 'id'> = {
    plan_name: '',
    display_name: '',
    amount_paise: 19900,
    original_amount_paise: 29900,
    currency: 'INR',
    billing_period_days: 30,
    checkout_description: '',
    features: [],
    sort_order: 50,
    is_popular: false,
    is_active: true,
};

export default function BillingPlansAdminPage() {
    const supabase = createClientComponentClient();
    const [plans, setPlans] = useState<BillingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<BillingPlan | null>(null);
    const [saving, setSaving] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [newPlan, setNewPlan] = useState<Omit<BillingPlan, 'id'>>(EMPTY_PLAN);
    const [featureInput, setFeatureInput] = useState('');
    const [newFeatureInput, setNewFeatureInput] = useState('');

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('billing_plan_settings')
            .select('*')
            .order('sort_order');
        if (error) { toast.error('Failed to load plans'); }
        else { setPlans(data || []); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const discountPct = (original: number | null, actual: number) => {
        if (!original || original <= actual) return null;
        return Math.round(((original - actual) / original) * 100);
    };

    const handleSaveEdit = async () => {
        if (!editing) return;
        setSaving(true);
        const { error } = await supabase
            .from('billing_plan_settings')
            .update({
                display_name: editing.display_name,
                amount_paise: editing.amount_paise,
                original_amount_paise: editing.original_amount_paise || null,
                billing_period_days: editing.billing_period_days,
                checkout_description: editing.checkout_description,
                features: editing.features,
                sort_order: editing.sort_order,
                is_popular: editing.is_popular,
                is_active: editing.is_active,
            })
            .eq('id', editing.id);
        if (error) {
            toast.error('Save failed: ' + error.message);
        } else {
            toast.success('Plan updated!');
            setEditing(null);
            await load();
        }
        setSaving(false);
    };

    const handleCreatePlan = async () => {
        if (!newPlan.plan_name.trim()) { toast.error('Plan name is required'); return; }
        setSaving(true);
        const { error } = await supabase.from('billing_plan_settings').insert({
            ...newPlan,
            features: newPlan.features,
        });
        if (error) { toast.error('Create failed: ' + error.message); }
        else { toast.success('Plan created!'); setShowNew(false); setNewPlan(EMPTY_PLAN); await load(); }
        setSaving(false);
    };

    const handleToggleActive = async (plan: BillingPlan) => {
        const { error } = await supabase
            .from('billing_plan_settings')
            .update({ is_active: !plan.is_active })
            .eq('id', plan.id);
        if (error) { toast.error('Update failed'); }
        else { await load(); }
    };

    const addFeature = (plan: BillingPlan, input: string, setInput: (v: string) => void) => {
        const val = input.trim();
        if (!val) return;
        setEditing({ ...plan, features: [...plan.features, val] });
        setInput('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Billing Plans</h2>
                    <p className="text-sm text-gray-500 mt-1">Edit pricing, features, and discounts shown to users</p>
                </div>
                <button
                    onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4" /> Add Plan
                </button>
            </div>

            {/* Plans grid */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {plans.map((plan) => {
                    const pct = discountPct(plan.original_amount_paise, plan.amount_paise);
                    const isEditing = editing?.id === plan.id;
                    const ep = isEditing ? editing! : plan;

                    return (
                        <div
                            key={plan.id}
                            className={`rounded-2xl border bg-white p-5 shadow-sm ${plan.is_popular ? 'border-blue-300' : 'border-gray-200'} ${!plan.is_active ? 'opacity-60' : ''}`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    {plan.is_popular && <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />}
                                    {isEditing ? (
                                        <input
                                            value={ep.display_name}
                                            onChange={e => setEditing({ ...ep, display_name: e.target.value })}
                                            className="rounded border border-blue-300 px-2 py-1 text-sm font-bold text-gray-900 outline-none"
                                        />
                                    ) : (
                                        <span className="font-bold text-gray-900">{plan.display_name}</span>
                                    )}
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-mono text-gray-500">{plan.plan_name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {isEditing ? (
                                        <>
                                            <button onClick={handleSaveEdit} disabled={saving} className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                                            </button>
                                            <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => { setEditing(plan); setFeatureInput(''); }} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50">
                                                <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                                            </button>
                                            <button onClick={() => handleToggleActive(plan)} className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${plan.is_active ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                                                {plan.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Pricing */}
                            <div className="mt-4">
                                {isEditing ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-500 uppercase">Actual Price (paise)</label>
                                            <input
                                                type="number"
                                                value={ep.amount_paise}
                                                onChange={e => setEditing({ ...ep, amount_paise: Number(e.target.value) })}
                                                className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                                                placeholder="e.g. 19900 = ₹199"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-0.5">= ₹{(ep.amount_paise / 100).toFixed(0)}</p>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-gray-500 uppercase">Original Price (paise)</label>
                                            <input
                                                type="number"
                                                value={ep.original_amount_paise ?? ''}
                                                onChange={e => setEditing({ ...ep, original_amount_paise: Number(e.target.value) || null })}
                                                className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                                                placeholder="e.g. 29900 = ₹299"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-0.5">Crossed-out price shown to users</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-2">
                                        <span className="text-3xl font-black text-gray-900">₹{(plan.amount_paise / 100).toFixed(0)}</span>
                                        {plan.original_amount_paise && plan.original_amount_paise > plan.amount_paise && (
                                            <span className="pb-1 text-base text-gray-400 line-through">₹{(plan.original_amount_paise / 100).toFixed(0)}</span>
                                        )}
                                        {pct && (
                                            <span className="mb-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">{pct}% OFF</span>
                                        )}
                                        <span className="pb-1 text-sm text-gray-400">/ {plan.billing_period_days} days</span>
                                    </div>
                                )}
                            </div>

                            {/* Description */}
                            <div className="mt-3">
                                {isEditing ? (
                                    <input
                                        value={ep.checkout_description ?? ''}
                                        onChange={e => setEditing({ ...ep, checkout_description: e.target.value })}
                                        className="w-full rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                                        placeholder="Short description shown in checkout"
                                    />
                                ) : (
                                    <p className="text-sm text-gray-500">{plan.checkout_description}</p>
                                )}
                            </div>

                            {/* Features */}
                            <div className="mt-4">
                                <p className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Features</p>
                                <ul className="space-y-1.5">
                                    {ep.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                            <span className="flex-1">{f}</span>
                                            {isEditing && (
                                                <button onClick={() => setEditing({ ...ep, features: ep.features.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                                {isEditing && (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            value={featureInput}
                                            onChange={e => setFeatureInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && addFeature(ep, featureInput, setFeatureInput)}
                                            placeholder="Add feature..."
                                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
                                        />
                                        <button onClick={() => addFeature(ep, featureInput, setFeatureInput)} className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200">
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Extra toggles when editing */}
                            {isEditing && (
                                <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={ep.is_popular} onChange={e => setEditing({ ...ep, is_popular: e.target.checked })} className="rounded" />
                                        <Star className="h-4 w-4 text-yellow-500" /> Mark as Popular
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={ep.is_active} onChange={e => setEditing({ ...ep, is_active: e.target.checked })} className="rounded" />
                                        <PackageCheck className="h-4 w-4 text-green-500" /> Active
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Tag className="h-4 w-4 text-gray-400" />
                                        <input
                                            type="number"
                                            value={ep.sort_order}
                                            onChange={e => setEditing({ ...ep, sort_order: Number(e.target.value) })}
                                            className="w-16 rounded border border-gray-200 px-1 py-0.5 text-xs"
                                            placeholder="Order"
                                        />
                                        <span className="text-xs text-gray-400">sort order</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create new plan modal */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">New Billing Plan</h3>
                            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500">Plan Slug (unique)</label>
                                    <input value={newPlan.plan_name} onChange={e => setNewPlan({ ...newPlan, plan_name: e.target.value.toLowerCase().replace(/\s/g, '_') })} placeholder="e.g. pro" className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500">Display Name</label>
                                    <input value={newPlan.display_name} onChange={e => setNewPlan({ ...newPlan, display_name: e.target.value })} placeholder="e.g. Pro Plan" className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500">Actual Price (paise)</label>
                                    <input type="number" value={newPlan.amount_paise} onChange={e => setNewPlan({ ...newPlan, amount_paise: Number(e.target.value) })} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                                    <p className="text-[10px] text-gray-400">= ₹{(newPlan.amount_paise / 100).toFixed(0)}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500">Original Price (paise)</label>
                                    <input type="number" value={newPlan.original_amount_paise ?? ''} onChange={e => setNewPlan({ ...newPlan, original_amount_paise: Number(e.target.value) || null })} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                                    <p className="text-[10px] text-gray-400">Crossed-out / strike-through price</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Description</label>
                                <input value={newPlan.checkout_description ?? ''} onChange={e => setNewPlan({ ...newPlan, checkout_description: e.target.value })} placeholder="Short tagline" className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500">Features (press Enter to add)</label>
                                <div className="mt-1 flex gap-2">
                                    <input value={newFeatureInput} onChange={e => setNewFeatureInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { if (newFeatureInput.trim()) { setNewPlan({ ...newPlan, features: [...newPlan.features, newFeatureInput.trim()] }); setNewFeatureInput(''); } } }} placeholder="Add feature..." className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
                                </div>
                                <ul className="mt-2 space-y-1">
                                    {newPlan.features.map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                            <span className="flex-1">{f}</span>
                                            <button onClick={() => setNewPlan({ ...newPlan, features: newPlan.features.filter((_, idx) => idx !== i) })} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={newPlan.is_popular} onChange={e => setNewPlan({ ...newPlan, is_popular: e.target.checked })} />
                                    Popular
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input type="checkbox" checked={newPlan.is_active} onChange={e => setNewPlan({ ...newPlan, is_active: e.target.checked })} />
                                    Active
                                </label>
                            </div>
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button onClick={() => setShowNew(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                            <button onClick={handleCreatePlan} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Create Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
