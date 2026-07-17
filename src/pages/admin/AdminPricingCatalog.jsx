import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { api } from "../../api";
import { FiAlertCircle, FiCheck } from "react-icons/fi";

const NETWORKS = ["mtn", "airtel", "glo", "9mobile"];
const CABLE_PROVIDERS = ["DSTV", "GOtv", "StarTimes"];
const TABS = ["Airtime", "Data", "Cable"];

const PlanTable = ({ rows, loading, onSave }) => {
  if (loading) return <div className="card-glass p-8 text-center text-white/35 font-dm text-sm">Loading...</div>;
  if (rows.length === 0) return <div className="card-glass p-8 text-center text-white/35 font-dm text-sm">No plans found.</div>;

  return (
    <div className="card-glass overflow-hidden">
      {rows.map((row, i) => (
        <div key={row.variationCode} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
          <div className="flex-1 min-w-0">
            <p className="text-white font-dm text-sm font-medium truncate">{row.label}</p>
            <p className="text-white/30 font-dm text-[11px]">VTpass price right now: ₦{row.liveVtpassPrice.toLocaleString()}</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <div>
              <label className="text-white/40 font-dm text-[11px] mb-1 block">Buying (₦)</label>
              <input type="number" defaultValue={row.buyingPrice} className="input-field !py-2 text-sm w-28"
                onBlur={(e) => onSave(row, "buyingPrice", e.target.value)} />
            </div>
            <div>
              <label className="text-white/40 font-dm text-[11px] mb-1 block">Selling (₦)</label>
              <input type="number" defaultValue={row.sellingPrice} className="input-field !py-2 text-sm w-28"
                onBlur={(e) => onSave(row, "sellingPrice", e.target.value)} />
            </div>
            <div className="flex flex-col justify-end pb-2.5">
              <span className={`font-dm text-xs whitespace-nowrap ${row.sellingPrice - row.buyingPrice >= 0 ? "text-secondary" : "text-red-400"}`}>
                {row.sellingPrice - row.buyingPrice >= 0 ? "+" : ""}₦{(row.sellingPrice - row.buyingPrice).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AdminPricingCatalog = () => {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [airtimeRows, setAirtimeRows] = useState([]);
  const [airtimeLoading, setAirtimeLoading] = useState(true);

  const [dataNetwork, setDataNetwork] = useState(NETWORKS[0]);
  const [dataServiceID, setDataServiceID] = useState("");
  const [dataRows, setDataRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [cableProvider, setCableProvider] = useState(CABLE_PROVIDERS[0]);
  const [cableServiceID, setCableServiceID] = useState("");
  const [cableRows, setCableRows] = useState([]);
  const [cableLoading, setCableLoading] = useState(false);

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const loadAirtime = async () => {
    setAirtimeLoading(true);
    try {
      const data = await api.get("/admin/product-prices/airtime");
      setAirtimeRows(data.rows || []);
    } catch (err) { setError(err.message); }
    setAirtimeLoading(false);
  };

  const loadData = async (network) => {
    setDataLoading(true);
    try {
      const data = await api.get(`/admin/product-prices/data/${network}`);
      setDataServiceID(data.serviceID);
      setDataRows(data.rows || []);
    } catch (err) { setError(err.message); }
    setDataLoading(false);
  };

  const loadCable = async (provider) => {
    setCableLoading(true);
    try {
      const data = await api.get(`/admin/product-prices/cable/${provider}`);
      setCableServiceID(data.serviceID);
      setCableRows(data.rows || []);
    } catch (err) { setError(err.message); }
    setCableLoading(false);
  };

  useEffect(() => { loadAirtime(); }, []);
  useEffect(() => { if (tab === 1) loadData(dataNetwork); }, [tab, dataNetwork]);
  useEffect(() => { if (tab === 2) loadCable(cableProvider); }, [tab, cableProvider]);

  const saveAirtimeRow = async (row, field, value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    const next = { ...row, [field]: num };
    setAirtimeRows((rows) => rows.map((r) => (r.serviceID === row.serviceID ? next : r)));
    try {
      await api.post("/admin/product-prices", {
        category: "airtime", serviceID: row.serviceID, key: row.serviceID,
        label: row.network.toUpperCase(), buyingPrice: next.buyingPrice, sellingPrice: next.sellingPrice,
      });
      flashSaved();
    } catch (err) { setError(err.message); }
  };

  const savePlanRow = (category, serviceID, setter) => async (row, field, value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    const next = { ...row, [field]: num };
    setter((rows) => rows.map((r) => (r.variationCode === row.variationCode ? next : r)));
    try {
      await api.post("/admin/product-prices", {
        category, serviceID, key: row.variationCode, label: row.label,
        buyingPrice: next.buyingPrice, sellingPrice: next.sellingPrice,
      });
      flashSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <AdminLayout>
      <div className="p-5 lg:p-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-syne font-bold text-white text-2xl">Pricing Catalog</h1>
            <p className="text-white/40 font-dm text-sm mt-1">Buying price (what VTpass charges) vs. selling price (what customers pay)</p>
          </div>
          {saved && <span className="flex items-center gap-1.5 text-secondary font-dm text-xs shrink-0"><FiCheck size={13} /> Saved</span>}
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

        {tab === 0 && (
          <div className="card-glass overflow-hidden">
            <p className="text-white/30 font-dm text-xs p-4 border-b border-white/8">
              Percent of face value — e.g. buying 98 / selling 99 on a ₦100 top-up charges the customer ₦99
              while VTpass costs ₦98, a ₦1 margin. An unconfigured network defaults to 100/100 (sell at face
              value, zero margin) rather than blocking sales.
            </p>
            {airtimeLoading ? (
              <div className="p-8 text-center text-white/35 font-dm text-sm">Loading...</div>
            ) : (
              airtimeRows.map((row, i) => (
                <div key={row.serviceID} className={`flex items-center gap-4 p-4 ${i < airtimeRows.length - 1 ? "border-b border-white/5" : ""}`}>
                  <p className="text-white font-dm text-sm font-medium w-20 uppercase shrink-0">{row.network}</p>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/40 font-dm text-[11px] mb-1 block">Buying %</label>
                      <input type="number" step="0.1" defaultValue={row.buyingPrice} className="input-field !py-2 text-sm"
                        onBlur={(e) => saveAirtimeRow(row, "buyingPrice", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-white/40 font-dm text-[11px] mb-1 block">Selling %</label>
                      <input type="number" step="0.1" defaultValue={row.sellingPrice} className="input-field !py-2 text-sm"
                        onBlur={(e) => saveAirtimeRow(row, "sellingPrice", e.target.value)} />
                    </div>
                  </div>
                  <p className={`font-dm text-xs w-24 text-right shrink-0 ${row.sellingPrice - row.buyingPrice >= 0 ? "text-secondary" : "text-red-400"}`}>
                    {(row.sellingPrice - row.buyingPrice).toFixed(1)}% margin
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 1 && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {NETWORKS.map((n) => (
                <button key={n} onClick={() => setDataNetwork(n)} className={`px-3 py-1.5 rounded-lg font-dm text-xs uppercase border transition-colors ${dataNetwork === n ? "bg-secondary/15 text-secondary border-secondary/25" : "text-white/50 border-white/10 hover:text-white"}`}>
                  {n}
                </button>
              ))}
            </div>
            <PlanTable rows={dataRows} loading={dataLoading} onSave={savePlanRow("data", dataServiceID, setDataRows)} />
          </>
        )}

        {tab === 2 && (
          <>
            <div className="flex gap-2 mb-4 flex-wrap">
              {CABLE_PROVIDERS.map((p) => (
                <button key={p} onClick={() => setCableProvider(p)} className={`px-3 py-1.5 rounded-lg font-dm text-xs border transition-colors ${cableProvider === p ? "bg-secondary/15 text-secondary border-secondary/25" : "text-white/50 border-white/10 hover:text-white"}`}>
                  {p}
                </button>
              ))}
            </div>
            <PlanTable rows={cableRows} loading={cableLoading} onSave={savePlanRow("cable", cableServiceID, setCableRows)} />
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPricingCatalog;
