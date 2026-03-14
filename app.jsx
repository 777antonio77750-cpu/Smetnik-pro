const tg=window.Telegram?.WebApp; if(tg){tg.ready();tg.expand();}

const { useState, useCallback, useEffect, useRef } = React;

const ROOMS = [
  { id: "living", label: "Гостиная", icon: "🛋" },
  { id: "bedroom", label: "Спальня", icon: "🛏" },
  { id: "kitchen", label: "Кухня", icon: "🍳" },
  { id: "bathroom", label: "Ванная", icon: "🚿" },
  { id: "toilet", label: "Туалет", icon: "🚽" },
  { id: "hallway", label: "Коридор", icon: "🚪" },
  { id: "balcony", label: "Балкон", icon: "🌿" },
  { id: "office", label: "Кабинет", icon: "💼" },
];

const WORK_TYPES = {
  base: [
    { id: "demolition", label: "Демонтаж", unit: "м²", prices: [300, 500, 800] },
    { id: "garbage", label: "Вывоз мусора", unit: "м³", prices: [800, 1200, 1800] },
  ],
  walls: [
    { id: "plaster", label: "Штукатурка стен", unit: "м²", prices: [450, 750, 1200] },
    { id: "putty", label: "Шпаклёвка стен", unit: "м²", prices: [300, 500, 900] },
    { id: "painting", label: "Покраска стен", unit: "м²", prices: [200, 400, 700] },
    { id: "wallpaper", label: "Поклейка обоев", unit: "м²", prices: [250, 450, 800] },
    { id: "tile_walls", label: "Плитка на стены", unit: "м²", prices: [800, 1400, 2500] },
  ],
  floor: [
    { id: "screed", label: "Стяжка пола", unit: "м²", prices: [400, 700, 1200] },
    { id: "laminate", label: "Ламинат", unit: "м²", prices: [350, 600, 1100] },
    { id: "tile_floor", label: "Плитка на пол", unit: "м²", prices: [700, 1200, 2200] },
    { id: "parquet", label: "Паркет/инженерная доска", unit: "м²", prices: [900, 1600, 3000] },
  ],
  ceiling: [
    { id: "ceiling_putty", label: "Шпаклёвка потолка", unit: "м²", prices: [350, 600, 1000] },
    { id: "ceiling_paint", label: "Покраска потолка", unit: "м²", prices: [250, 450, 750] },
    { id: "stretch", label: "Натяжной потолок", unit: "м²", prices: [600, 900, 1800] },
    { id: "gypsum", label: "ГКЛ потолок", unit: "м²", prices: [700, 1100, 1900] },
  ],
  electrical: [
    { id: "wiring", label: "Замена проводки", unit: "точка", prices: [1200, 2000, 3500] },
    { id: "panel", label: "Щиток/автоматы", unit: "шт", prices: [3000, 6000, 12000] },
    { id: "sockets", label: "Розетки/выключатели", unit: "шт", prices: [400, 700, 1200] },
  ],
  plumbing: [
    { id: "pipes", label: "Замена труб", unit: "п.м.", prices: [800, 1500, 2800] },
    { id: "bathroom_install", label: "Монтаж сантехники", unit: "шт", prices: [2500, 4500, 8000] },
    { id: "radiators", label: "Радиаторы отопления", unit: "шт", prices: [3000, 5500, 10000] },
  ],
};

const QUALITY_LABELS = ["Эконом", "Стандарт", "Премиум"];
const QUALITY_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6"];
const SECTION_LABELS = {
  base: "Базовые работы", walls: "Стены", floor: "Пол",
  ceiling: "Потолок", electrical: "Электрика", plumbing: "Сантехника",
};
const TABS = [
  { id: "calculator", label: "СМЕТА", icon: "📐" },
  { id: "logistics", label: "ЛОГИСТИКА", icon: "📦" },
  { id: "ai", label: "ИИ-ПРОРАБ", icon: "🤖" },
];
const DEFAULT_LOGISTICS = [
  { id: 1, material: "Цемент М500", qty: 20, unit: "мешок", status: "delivered", date: "2024-03-10", supplier: "СтройМаркет" },
  { id: 2, material: "ГКЛ Knauf 12мм", qty: 50, unit: "лист", status: "transit", date: "2024-03-15", supplier: "Кнауф-Маркет" },
  { id: 3, material: "Плитка Atlas Concorde", qty: 45, unit: "м²", status: "pending", date: "2024-03-18", supplier: "ТД Плитка" },
  { id: 4, material: "Кабель ВВГнг 3×2.5", qty: 200, unit: "м.п.", status: "transit", date: "2024-03-14", supplier: "ЭлектроОпт" },
];
const statusConfig = {
  delivered: { label: "Доставлено", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  transit: { label: "В пути", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  pending: { label: "Ожидание", color: "#64748b", bg: "rgba(100,116,139,0.1)" },
  issue: { label: "Проблема", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};
const STORAGE_KEY = "smetnik-state-v1";
async function saveState(state) {
  try { await window.storage.set(STORAGE_KEY, JSON.stringify(state)); } catch {}
}
async function loadState() {
  try {
    const r = await window.storage.get(STORAGE_KEY);
    return r ? JSON.parse(r.value) : null;
  } catch { return null; }
}

function RepairBot() {
  const [activeTab, setActiveTab] = useState("calculator");
  const [rooms, setRooms] = useState([]);
  const [quality, setQuality] = useState(1);
  const [selectedWorks, setSelectedWorks] = useState({});
  const [workQuantities, setWorkQuantities] = useState({});
  const [logistics, setLogistics] = useState(DEFAULT_LOGISTICS);
  const [newDelivery, setNewDelivery] = useState({ material: "", qty: "", unit: "", supplier: "", date: "" });
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", content: "Здравствуйте! Я ваш ИИ-прораб. Готов помочь с расчётом смет, подбором материалов и советами по ремонту." }
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [clientName, setClientName] = useState("");
  const [objectAddress, setObjectAddress] = useState("");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [pdfLoading, setPdfLoading] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (!s) return;
      if (s.rooms) setRooms(s.rooms);
      if (s.quality != null) setQuality(s.quality);
      if (s.selectedWorks) setSelectedWorks(s.selectedWorks);
      if (s.workQuantities) setWorkQuantities(s.workQuantities);
      if (s.logistics) setLogistics(s.logistics);
      if (s.clientName) setClientName(s.clientName);
      if (s.objectAddress) setObjectAddress(s.objectAddress);
      setSaveStatus("loaded");
      setTimeout(() => setSaveStatus("idle"), 2500);
    })();
  }, []);

  const triggerSave = useCallback((patch) => {
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(async () => {
      await saveState(patch);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);
  }, []);

  const updateRooms = (v) => { setRooms(v); triggerSave({ rooms: v, quality, selectedWorks, workQuantities, logistics, clientName, objectAddress }); };
  const updateQuality = (v) => { setQuality(v); triggerSave({ rooms, quality: v, selectedWorks, workQuantities, logistics, clientName, objectAddress }); };
  const updateSelectedWorks = (v) => { setSelectedWorks(v); triggerSave({ rooms, quality, selectedWorks: v, workQuantities, logistics, clientName, objectAddress }); };
  const updateWorkQuantities = (v) => { setWorkQuantities(v); triggerSave({ rooms, quality, selectedWorks, workQuantities: v, logistics, clientName, objectAddress }); };
  const updateLogistics = (v) => { setLogistics(v); triggerSave({ rooms, quality, selectedWorks, workQuantities, logistics: v, clientName, objectAddress }); };
  const updateClientName = (v) => { setClientName(v); triggerSave({ rooms, quality, selectedWorks, workQuantities, logistics, clientName: v, objectAddress }); };
  const updateObjectAddress = (v) => { setObjectAddress(v); triggerSave({ rooms, quality, selectedWorks, workQuantities, logistics, clientName, objectAddress: v }); };

  const toggleRoom = (id) => { const v = rooms.includes(id) ? rooms.filter(r => r !== id) : [...rooms, id]; updateRooms(v); };
  const toggleWork = (workId) => {
    const v = { ...selectedWorks, [workId]: !selectedWorks[workId] };
    updateSelectedWorks(v);
    if (!workQuantities[workId]) updateWorkQuantities({ ...workQuantities, [workId]: 1 });
  };
  const setQty = (workId, val) => updateWorkQuantities({ ...workQuantities, [workId]: Math.max(0.1, Number(val)) });

  const calcTotal = useCallback(() => {
    let items = [], total = 0;
    Object.entries(WORK_TYPES).forEach(([section, works]) => {
      works.forEach(w => {
        if (selectedWorks[w.id]) {
          const qty = workQuantities[w.id] || 1, price = w.prices[quality], sum = qty * price;
          total += sum;
          items.push({ ...w, qty, price, sum, section });
        }
      });
    });
    return { items, total };
  }, [selectedWorks, workQuantities, quality]);

  const cycleStatus = (id) => {
    const order = ["pending", "transit", "delivered", "issue"];
    const v = logistics.map(item => item.id !== id ? item : { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] });
    updateLogistics(v);
  };
  const addDelivery = () => {
    if (!newDelivery.material || !newDelivery.qty) return;
    updateLogistics([...logistics, { ...newDelivery, id: Date.now(), status: "pending", qty: Number(newDelivery.qty) }]);
    setNewDelivery({ material: "", qty: "", unit: "", supplier: "", date: "" });
  };
  const removeDelivery = (id) => updateLogistics(logistics.filter(i => i.id !== id));

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: aiInput };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    setAiLoading(true);
    const { items, total } = calcTotal();
    const context = rooms.length > 0
      ? `Проект: ${rooms.join(", ")}. Уровень: ${QUALITY_LABELS[quality]}. Итого: ${total.toLocaleString("ru")} ₽.`
      : "Смета не сформирована.";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `Ты опытный прораб и сметчик с 20-летним стажем в России. Отвечаешь чётко, по делу, на русском языке. ${context}`,
          messages: updated.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: "assistant", content: data.content?.[0]?.text || "Ошибка." }]);
    } catch { setAiMessages(prev => [...prev, { role: "assistant", content: "⚠️ Ошибка соединения." }]); }
    setAiLoading(false);
  };

  const { items: estimateItems, total: estimateTotal } = calcTotal();
  return (
    <div style={{ minHeight: "100vh", background: "#0a0c0f", color: "#e2e8f0", fontFamily: "'Courier New', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#f59e0b}
        .room-btn,.tab-btn,.status-badge,.del-btn{cursor:pointer;transition:all .15s}
        .room-btn:hover{transform:translateY(-2px)}
        .tab-btn:hover{color:#f59e0b}
        .checkbox-custom{width:16px;height:16px;border:2px solid #334155;border-radius:3px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .checkbox-custom.checked{background:#f59e0b;border-color:#f59e0b}
        .qty-input{background:#0f1215;border:1px solid #1e2530;color:#f59e0b;width:65px;padding:4px 6px;border-radius:4px;font-family:'Courier New',monospace;font-size:12px;text-align:right}
        .qty-input:focus{outline:none;border-color:#f59e0b}
        .chat-input{background:#0f1215;border:1px solid #1e2530;color:#e2e8f0;padding:10px 14px;border-radius:6px;font-family:'Courier New',monospace;font-size:13px;resize:none;width:100%}
        .chat-input:focus{outline:none;border-color:#f59e0b}
        .meta-input{background:#0f1215;border:1px solid #1e2530;color:#e2e8f0;padding:8px 10px;border-radius:4px;font-family:'Courier New',monospace;font-size:12px;width:100%}
        .meta-input:focus{outline:none;border-color:#f59e0b}
        .meta-input::placeholder{color:#475569}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn .3s ease}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .pulse{animation:pulse 2s infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        .blink{animation:blink 1s infinite}
      `}</style>

      <div style={{ background: "#0d1117", borderBottom: "2px solid #f59e0b", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "#f59e0b", width: 6, height: 26, borderRadius: 2 }} />
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: 3, color: "#f59e0b" }}>СМЕТЧИК PRO</div>
              <div style={{ fontSize: 8, color: "#475569", letterSpacing: 2 }}>
                {{ saving: "⟳ сохранение...", saved: "✓ сохранено", loaded: "↑ загружено", idle: "● автосохранение" }[saveStatus]}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }} className="pulse">● ONLINE</div>
        </div>
      </div>

      <div style={{ background: "#0d1117", borderBottom: "1px solid #1e2530", display: "flex" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, background: "none", border: "none", padding: "12px 4px",
            color: activeTab === tab.id ? "#f59e0b" : "#475569",
            fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2,
            borderBottom: activeTab === tab.id ? "3px solid #f59e0b" : "3px solid transparent",
            marginBottom: -1, cursor: "pointer"
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>

      <div style={{ padding: 14 }}>

        {activeTab === "calculator" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 10 }}>// ДАННЫЕ КЛИЕНТА</div>
              <input className="meta-input" placeholder="Имя клиента" value={clientName} onChange={e => updateClientName(e.target.value)} style={{ marginBottom: 8 }} />
              <input className="meta-input" placeholder="Адрес объекта" value={objectAddress} onChange={e => updateObjectAddress(e.target.value)} />
            </div>

            <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 10 }}>// УРОВЕНЬ РЕМОНТА</div>
              <div style={{ display: "flex", gap: 6 }}>
                {QUALITY_LABELS.map((q, i) => (
                  <button key={i} onClick={() => updateQuality(i)} style={{
                    flex: 1, padding: "10px 4px", border: `2px solid ${quality === i ? QUALITY_COLORS[i] : "#1e2530"}`,
                    background: quality === i ? `${QUALITY_COLORS[i]}18` : "transparent",
                    color: quality === i ? QUALITY_COLORS[i] : "#475569",
                    borderRadius: 6, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer"
                  }}>{q}</button>
                ))}
              </div>
            </div>

            <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 10 }}>// ПОМЕЩЕНИЯ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {ROOMS.map(r => (
                  <div key={r.id} className="room-btn" onClick={() => toggleRoom(r.id)} style={{
                    padding: "10px 4px", borderRadius: 6, textAlign: "center", userSelect: "none",
                    border: `1px solid ${rooms.includes(r.id) ? "#f59e0b" : "#1e2530"}`,
                    background: rooms.includes(r.id) ? "rgba(245,158,11,0.08)" : "#0a0c0f"
                  }}>
                    <div style={{ fontSize: 18 }}>{r.icon}</div>
                    <div style={{ fontSize: 9, color: rooms.includes(r.id) ? "#f59e0b" : "#475569", marginTop: 3 }}>{r.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {Object.entries(WORK_TYPES).map(([section, works]) => (
              <div key={section} style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 10 }}>// {SECTION_LABELS[section].toUpperCase()}</div>
                {works.map(w => {
                  const checked = !!selectedWorks[w.id];
                  return (
                    <div key={w.id} onClick={() => toggleWork(w.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderRadius: 5, cursor: "pointer", background: checked ? "rgba(245,158,11,0.04)" : "transparent", marginBottom: 2 }}>
                      <div className={`checkbox-custom ${checked ? "checked" : ""}`}>
                        {checked && <span style={{ color: "#000", fontSize: 9, fontWeight: 900 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: checked ? "#e2e8f0" : "#94a3b8" }}>{w.label}</div>
                      {checked && <input type="number" className="qty-input" value={workQuantities[w.id] || 1} onClick={e => e.stopPropagation()} onChange={e => setQty(w.id, e.target.value)} min="0.1" step="0.5" />}
                      <div style={{ fontSize: 10, color: QUALITY_COLORS[quality], fontWeight: 700, whiteSpace: "nowrap" }}>{w.prices[quality].toLocaleString("ru")}₽</div>
                    </div>
                  );
                })}
              </div>
            ))}

            {estimateItems.length > 0 && (
              <div className="fade-in" style={{ background: "#0d1117", border: "1px solid #f59e0b40", borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 12 }}>// ИТОГО</div>
                {estimateItems.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px solid #0f1215" }}>
                    <span style={{ color: "#94a3b8", flex: 1 }}>{item.label}</span>
                    <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{item.sum.toLocaleString("ru")} ₽</span>
                  </div>
                ))}
                <div style={{ borderTop: "2px solid #f59e0b", paddingTop: 12, marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>РАБОТЫ:</span>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 24, color: "#f59e0b" }}>{estimateTotal.toLocaleString("ru")} ₽</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e2530" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>ОБЩИЙ БЮДЖЕТ:</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>~{Math.round(estimateTotal * [1.8,2.2,3][quality]).toLocaleString("ru")} ₽</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "logistics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <div key={key} style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 12, borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ fontSize: 24, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, color: cfg.color }}>{logistics.filter(i => i.status === key).length}</div>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>{cfg.label.toUpperCase()}</div>
                </div>
              ))}
            </div>
            {logistics.map(item => {
              const st = statusConfig[item.status];
              return (
                <div key={item.id} style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 4 }}>{item.material}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{item.qty} {item.unit} · {item.supplier}</div>
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{item.date}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <div className="status-badge" onClick={() => cycleStatus(item.id)} style={{ padding: "4px 10px", borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.color}40`, fontSize: 10 }}>{st.label}</div>
                      <div className="del-btn" onClick={() => removeDelivery(item.id)} style={{ color: "#ef4444", fontSize: 12, opacity: 0.5 }}>✕ удалить</div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ background: "#0d1117", border: "1px solid #1e2530", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: 3, marginBottom: 10 }}>// ДОБАВИТЬ</div>
              {["material","qty","unit","supplier","date"].map(field => (
                <input key={field} className="meta-input" style={{ marginBottom: 6 }}
                  placeholder={{ material:"Материал", qty:"Количество", unit:"Ед. изм.", supplier:"Поставщик", date:"Дата (2024-03-20)" }[field]}
                  type={field === "qty" ? "number" : field === "date" ? "date" : "text"}
                  value={newDelivery[field]} onChange={e => setNewDelivery(p => ({ ...p, [field]: e.target.value }))} />
              ))}
              <button onClick={addDelivery} style={{ width: "100%", background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "10px", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>+ ДОБАВИТЬ ПОСТАВКУ</button>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "calc(100vh - 140px)" }}>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {aiMessages.map((msg, i) => (
                <div key={i} className="fade-in" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, background: msg.role === "user" ? "rgba(59,130,246,0.15)" : "rgba(245,158,11,0.12)", border: `1px solid ${msg.role === "user" ? "rgba(59,130,246,0.3)" : "rgba(245,158,11,0.25)"}` }}>
                    {msg.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", borderRadius: 6, fontSize: 13, lineHeight: 1.7, background: msg.role === "user" ? "rgba(59,130,246,0.06)" : "rgba(245,158,11,0.04)", border: `1px solid ${msg.role === "user" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.1)"}`, color: "#e2e8f0", whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>🤖</div>
                  <div style={{ padding: "10px 12px", borderRadius: 6, background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.1)" }}>
                    <span className="blink" style={{ fontSize: 18, color: "#f59e0b" }}>● ● ●</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea className="chat-input" rows={2} value={aiInput} onChange={e => setAiInput(e.target.value)}
                placeholder="Спросите прораба..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }} />
              <button onClick={sendAiMessage} disabled={aiLoading} style={{ background: aiLoading ? "#334155" : "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "0 16px", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 16, cursor: aiLoading ? "not-allowed" : "pointer" }}>▶</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RepairBot));
