import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../api";
import { FiAlertCircle, FiCheck, FiAlertTriangle } from "react-icons/fi";

const TABS = ["System Settings", "Services Control", "Pricing"];

const Toggle = ({ on, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${on ? "bg-secondary" : "bg-white/15"}`}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? "left-5" : "left-0.5"}`} />
  </button>
);

const AdminSettings = () => {
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/admin/settings");
      setSettings(data.settings);
    } catch (err) {
      setError(err.message || "Failed to load settings.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    setSaving(true);
    setSaved(false);
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.post("/admin/settings", patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || "Failed to save.");
    }
    setSaving(false);
  };

  const services = settings?.servicesEnabled || {};
  const pricing = settings?.pricing || {};
  const general = settings?.general || {};

  return (
    <AdminLayout>
      <div className="p-5 lg:p-8 max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-syne font-bold text-white text-2xl">Settings</h1>
            <p className="text-white/40 font-dm text-sm mt-1">System settings, service toggles, and pricing</p>
          </div>
          {saved && <span className="flex items-center gap-1.5 text-secondary font-dm text-xs"><FiCheck size={13} /> Saved</span>}
        </div>

        <div className="flex gap-2 mb-6">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className={`px-4 py-2 rounded-xl font-dm text-sm border transition-colors ${tab === i ? "bg-secondary/15 text-secondary border-secondary/25" : "text-white/50 border-white/10 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <FiAlertCircle className="text-red-400 mt-0.5 shrink-0" size={16} />
            <p className="text-red-400 font-dm text-sm">{error}</p>
          </div>
        )}

        {loading || !settings ? (
          <div className="card-glass p-8 text-center text-white/35 font-dm text-sm">Loading settings...</div>
        ) : tab === 0 ? (
          <div className="card-glass p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-dm text-sm font-medium">Maintenance Mode</p>
                <p className="text-white/35 font-dm text-xs">Blocks new deposits/transfers app-wide when on</p>
              </div>
              <Toggle on={settings.maintenanceMode} onClick={() => save({ maintenanceMode: !settings.maintenanceMode })} />
            </div>
            {settings.maintenanceMode && (
              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">
                <FiAlertTriangle className="text-yellow-400 mt-0.5 shrink-0" size={14} />
                <p className="text-yellow-400 font-dm text-xs">
                  This flag is stored, but nothing in functions/index.js reads it yet — wire a check into
                  verifyDeposit/initiateTransfer/etc. for it to actually block anything. See ADMIN_SETUP.md.
                </p>
              </div>
            )}
            <div>
              <label className="text-white/60 font-dm text-xs mb-1.5 block">Support Email</label>
              <input className="input-field" defaultValue={general.supportEmail} onBlur={(e) => save({ general: { ...general, supportEmail: e.target.value } })} placeholder="support@abopay.ng" />
            </div>
            <div>
              <label className="text-white/60 font-dm text-xs mb-1.5 block">Support Phone</label>
              <input className="input-field" defaultValue={general.supportPhone} onBlur={(e) => save({ general: { ...general, supportPhone: e.target.value } })} placeholder="+234..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Min Transfer (₦)</label>
                <input type="number" className="input-field" defaultValue={general.minTransfer} onBlur={(e) => save({ general: { ...general, minTransfer: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Max Transfer (₦)</label>
                <input type="number" className="input-field" defaultValue={general.maxTransfer} onBlur={(e) => save({ general: { ...general, maxTransfer: Number(e.target.value) } })} />
              </div>
            </div>
          </div>
        ) : tab === 1 ? (
          <div className="card-glass p-6 flex flex-col gap-4">
            <p className="text-white/30 font-dm text-xs mb-1">
              Same as Maintenance Mode: these flags are stored and ready, but each Cloud Function needs a
              one-line read of this doc to actually enforce the toggle. See ADMIN_SETUP.md for exactly where.
            </p>
            {Object.entries(services).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between">
                <p className="text-white font-dm text-sm capitalize">{key}</p>
                <Toggle on={val} onClick={() => save({ servicesEnabled: { ...services, [key]: !val } })} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card-glass p-6 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Transfer Fee (flat ₦)</label>
                <input type="number" className="input-field" defaultValue={pricing.transferFeeFlat} onBlur={(e) => save({ pricing: { ...pricing, transferFeeFlat: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Transfer Fee (%)</label>
                <input type="number" step="0.1" className="input-field" defaultValue={pricing.transferFeePercent} onBlur={(e) => save({ pricing: { ...pricing, transferFeePercent: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Airtime Discount (%)</label>
                <input type="number" step="0.1" className="input-field" defaultValue={pricing.airtimeDiscountPercent} onBlur={(e) => save({ pricing: { ...pricing, airtimeDiscountPercent: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Data Discount (%)</label>
                <input type="number" step="0.1" className="input-field" defaultValue={pricing.dataDiscountPercent} onBlur={(e) => save({ pricing: { ...pricing, dataDiscountPercent: Number(e.target.value) } })} />
              </div>
              <div>
                <label className="text-white/60 font-dm text-xs mb-1.5 block">Bill Payment Fee (flat ₦)</label>
                <input type="number" className="input-field" defaultValue={pricing.billFeeFlat} onBlur={(e) => save({ pricing: { ...pricing, billFeeFlat: Number(e.target.value) } })} />
              </div>
            </div>
            <p className="text-white/30 font-dm text-xs">
              Same caveat as the other tabs: these numbers are stored centrally, but purchaseAirtime/
              purchaseData/payBill/initiateTransfer in functions/index.js need to read them when
              calculating what to charge for this to take effect.
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
