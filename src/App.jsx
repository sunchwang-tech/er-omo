import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';

// === Firebase 雲端初始化設定 ===
const firebaseConfig = {
  apiKey: "AIzaSyCtkjjg0bkfhua0ttmFw3sEQ0NJM4z7g48",
  authDomain: "er-omo.firebaseapp.com",
  projectId: "er-omo",
  storageBucket: "er-omo.firebasestorage.app",
  messagingSenderId: "402348034619",
  appId: "1:402348034619:web:d756aa4bdd7bbab92e2a1e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === 系統常數與地圖資料 ===
const MAP_LAYOUT_1F = [
  [2, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 7, 2],
  [2, 6, 1, 2, 2, 2, 1, 4, 4, 2, 1, 2], 
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 1, 2, 2, 2, 1, 4, 4, 2, 1, 2],
  [2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 5, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2],
  [2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 2],
  [2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2],
];

const MAP_LANDMARKS = {
  'er_entrance': {row:9, col:7, icon: '🚪', label: '急診入口', navPath: '216,360 216,456 360,456'},
  'pharmacy': {row:0, col:1, icon: '💊', label: '急診藥局', color: 'bg-amber-400', guide: '請往大門方向走，批價櫃檯旁即是藥局。', navPath: '216,360 216,24 72,24'},
  'cashier': {row:0, col:2, icon: '💳', label: '批價掛號', guide: '請前往急診大門入口處，右側即是批價掛號櫃檯。', navPath: '216,360 216,24 120,24'}, 
  'elevator': {row:3, col:1, icon: '🛗', label: '電梯', guide: '請沿著走廊直走，檢驗科對面即是電梯。', navPath: '216,360 216,168 72,168'},
  'xray': {row:3, col:7, icon: '☢️', label: 'X光室', guide: '請直走，經過檢驗科後右轉即可抵達 X 光室。', navPath: '216,360 360,360 360,168'},
  'ct': {row:3, col:8, icon: '🖥️', label: '電腦斷層', guide: '正在為您導航至 電腦斷層。請直走，經過 X 光室後，最深處即是電腦斷層室。', navPath: '216,360 360,360 360,168 408,168'}, 
  'us': {row:5, col:7, icon: '🌊', label: '超音波室', guide: '正在為您導航至 超音波室。請往急救區方向走，超音波室在您的右側。', navPath: '216,360 360,360 360,264'},
  'mri': {row:5, col:8, icon: '🧲', label: '核磁共振', guide: '請往急救區方向走，經過超音波室後，最內部即是核磁共振室。', navPath: '216,360 360,360 360,264 408,264'},
  'lab_dept': {row:6, col:1, icon: '🔬', label: '檢驗科', color: 'bg-rose-400', guide: '正在為您導航至 檢驗科 (抽血/心電圖)。請直走，前方左側即是。', navPath: '216,360 216,312 72,312'}, 
  'nurse': {row:2, col:10, icon: '👩‍⚕️', label: '護理站', color: 'bg-sky-400', guide: '請沿著中央主走廊直走到底，護理站就在正前方。', navPath: '216,360 216,120 504,120'},
  'icu': {row:5, col:2, icon: '🏥', label: '加護病房', color: 'bg-red-400', guide: '請先搭乘電梯至 3 樓，出電梯後依循指標前往加護病房。', navPath: '216,360 216,264 120,264'},
  'restroom': {row:8, col:1, icon: '🚻', label: '廁所', guide: '請往急診大門方向走，左側走廊進去即是洗手間。', navPath: '216,360 216,408 72,408'},
  'water': {row:0, col:10, icon: '🚰', label: '飲水機', guide: '飲水機位於護理站後方的公共休息區。', navPath: '216,360 216,24 504,24'},
  'soiled': {row:2, col:1, icon: '🧺', label: '污物室', guide: '污物室位於靠近電梯與洗手間的走廊角落。', navPath: '216,360 216,120 72,120'}
};

const NAV_DESTINATIONS = Object.entries(MAP_LANDMARKS).map(([id, data]) => ({ id, ...data }));

const PATIENTS_LIST = Array.from({ length: 70 }, (_, i) => ({
  id: `A${String(100 + i).padStart(3, '0')}`,
  bed: String(i + 1).padStart(2, '0'),
  name: ['李Ｏ雄', '林Ｏ花', '王Ｏ吉', '陳Ｏ明', '張Ｏ雅', '黃Ｏ智', '吳Ｏ成', '周Ｏ芬', '劉Ｏ宏', '鄭Ｏ珊'][i % 10],
  triageLevel: (i % 5) + 1,
  initialWaitingCount: Math.floor(Math.random() * 60) + 10,
  token: `tk_${Math.random().toString(36).substr(2, 6)}`,
  idLast4: '0000',
  zone: ['看診區', '兒科區', '留觀區', '重症區'][i % 4]
}));

const STAFF_LIST = [{ name: '李護理師' }, { name: '陳護理師' }, { name: '林護理師' }, { name: '王護理師' }];
const MED_STEPS = ['檢傷/掛號', '看診', '檢驗/檢查', '報告', '留觀/離院'];

const LAB_TYPES = [
  { id: 'lab_dept', label: '檢驗科', colorCls: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'urine', label: '尿液', colorCls: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'xray', label: 'X光', colorCls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'us', label: '超音波', colorCls: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { id: 'ct', label: 'CT', colorCls: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'mri', label: 'MRI', colorCls: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'other', label: '其他', colorCls: 'text-slate-600 bg-slate-100 border-slate-300' }
];

const REMINDERS = [
  { id: 'water', label: '禁喝水', icon: '💧' },
  { id: 'food', label: '禁飲食', icon: '🍔' },
  { id: 'bed', label: '需臥床', icon: '🛏️' },
  { id: 'urine', label: '留尿液', icon: '🧪' }
];

const FAQS = [
  { q: '床單、棉被可以到哪裡取？', a: '請向護理站告知後，由護理人員引導至被服室領取或由家屬代領。' },
  { q: '輪椅、陪病椅可以去哪裡借？', a: '急診大門口服務台提供輪椅借用；陪病椅則位於病床下方，請依指示拉出。' },
  { q: '飲食、尿布及清潔用品在哪裡可以購買？', a: '本院地下一樓設有超商及醫療用品店。' },
  { q: '繳費後連結何時失效？', a: '批價完成後約 30 分鐘，系統將自動註銷以保護隱私。' }
];

const Icon = ({ name, className = '', size = 24 }) => (
  <span className={`inline-flex items-center justify-center shrink-0 ${className}`} style={{ fontSize: `${size}px` }}>{name}</span>
);

const getTriageStyle = (level) => {
  const styles = {
    1: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', name: '檢傷 1 級' },
    2: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', name: '檢傷 2 級' },
    3: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', name: '檢傷 3 級' },
    4: { color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', name: '檢傷 4 級' },
    5: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', name: '檢傷 5 級' }
  };
  return styles[level] || styles[3];
};

const SwipeToConfirm = ({ onConfirm, text, bgClass, textClass, icon }) => {
  const [dragX, setDragX] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const containerRef = useRef(null);
  
  const handleMove = (clientX) => {
    if (unlocked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let newX = clientX - rect.left - 24;
    newX = Math.max(0, Math.min(newX, rect.width - 48));
    setDragX(newX);
    if (newX >= rect.width - 58) {
      setUnlocked(true); setDragX(rect.width - 48);
      setTimeout(() => { onConfirm(); setUnlocked(false); setDragX(0); }, 500);
    }
  };
  const handleEnd = () => { if (!unlocked) setDragX(0); };
  
  return (
    <div ref={containerRef} className={`relative w-full h-10 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden touch-none select-none transition-colors duration-300 ${unlocked ? 'bg-emerald-500' : bgClass}`} 
         onTouchMove={e=>handleMove(e.touches[0].clientX)} onTouchEnd={handleEnd} onMouseMove={e=>e.buttons===1&&handleMove(e.clientX)} onMouseUp={handleEnd} onMouseLeave={handleEnd}>
      <span className={`text-xs sm:text-sm font-bold z-0 transition-opacity ${unlocked ? 'text-white' : textClass}`}>{unlocked ? '✅ 已確認' : text}</span>
      <div className={`absolute left-1 top-1 w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-md z-10 transition-transform ${unlocked ? 'opacity-0' : ''}`} 
           style={{ transform: `translateX(${dragX}px)`, transition: dragX===0?'transform 0.3s ease':'none' }}>{icon || <Icon name="▶️" size={16}/>}</div>
    </div>
  );
};

const HeaderSettings = ({ settings, toggleSetting }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    <button onClick={() => toggleSetting('voice')} className={`p-2 rounded-full transition-colors ${settings.voice ? 'bg-sky-100 text-sky-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}><Icon name={settings.voice ? "🔊" : "🔇"} size={18}/></button>
    <button onClick={() => toggleSetting('vibe')} className={`p-2 rounded-full transition-colors ${settings.vibe ? 'bg-amber-100 text-amber-600 shadow-sm' : 'bg-slate-100 text-slate-400'}`}><Icon name="📳" size={18}/></button>
    <button onClick={() => toggleSetting('elderMode')} className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 font-bold text-sm ${settings.elderMode ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
       <Icon name="Aa" size={16}/> {settings.elderMode ? '放大' : '標準'}
    </button>
    <button onClick={() => toggleSetting('isDarkMode')} className="p-2 rounded-full bg-slate-100 text-slate-500"><Icon name={settings.isDarkMode ? "☀️" : "🌙"} size={18}/></button>
  </div>
);

function MainApp() {
  const [role, setRole] = useState(null);
  const [staffTarget, setStaffTarget] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [settings, setSettings] = useState({ voice: true, vibe: true, elderMode: false, isDarkMode: false });
  
  // === Firebase 雲端狀態 ===
  const [patientsState, setPatientsState] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [commands, setCommands] = useState([]);
  const [systemConfig, setSystemConfig] = useState({ marqueeText: '【急診衛教宣導】進入醫療中心請全程配戴口罩。' });

  // === 初始化 Firebase 監聽器 ===
  useEffect(() => {
    // 監聽患者狀態
    const psRef = ref(db, 'patientsState');
    const psUnsub = onValue(psRef, (snapshot) => {
      setPatientsState(snapshot.val() || {});
    });

    // 監聽警報任務 (陣列處理)
    const alertsRef = ref(db, 'alerts');
    const alertsUnsub = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAlerts(Object.values(data).sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setAlerts([]);
      }
    });

    // 監聽指令
    const cmdRef = ref(db, 'commands');
    const cmdUnsub = onValue(cmdRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
         setCommands(Object.values(data));
      } else {
         setCommands([]);
      }
    });

    // 監聽系統設定
    const sysRef = ref(db, 'systemConfig');
    const sysUnsub = onValue(sysRef, (snapshot) => {
       setSystemConfig(snapshot.val() || { marqueeText: '【急診衛教宣導】進入醫療中心請全程配戴口罩。' });
    });

    return () => {
      psUnsub(); alertsUnsub(); cmdUnsub(); sysUnsub();
    };
  }, []);

  // 倒數計時器機制 (移至頂層以確保全域運作，依賴於 patientsState)
  useEffect(() => {
    const interval = setInterval(() => {
      const updates = {};
      let hasUpdates = false;
      
      PATIENTS_LIST.forEach(p => {
        const st = patientsState[p.id] || {};
        if (st.dischargeCountdown !== undefined && st.dischargeCountdown !== null && !st.isDischarged) {
          if (st.dischargeCountdown > 1) {
             updates[`patientsState/${p.id}/dischargeCountdown`] = st.dischargeCountdown - 1;
             hasUpdates = true;
          } else {
             // 倒數結束，觸發結案並清除倒數
             updates[`patientsState/${p.id}/isDischarged`] = true;
             updates[`patientsState/${p.id}/currentStatus`] = '已結案';
             updates[`patientsState/${p.id}/dischargeCountdown`] = null;
             hasUpdates = true;
          }
        }
      });

      if (hasUpdates) {
        update(ref(db), updates);
      }
    }, 60000); // 每分鐘執行一次
    return () => clearInterval(interval);
  }, [patientsState]);

  useEffect(() => {
    if (settings.elderMode) {
      document.documentElement.classList.add('elder-mode');
    } else {
      document.documentElement.classList.remove('elder-mode');
    }
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.elderMode, settings.isDarkMode]);

  // V62.8 關鍵修復: 確保讀取最新狀態，並直接寫入 Firebase
  const getPatientData = (id) => {
    const defaultData = { 
        currentStep: 1, 
        currentStatus: '等候醫師看診/開單', 
        waitingCount: PATIENTS_LIST.find(p=>p.id===id)?.initialWaitingCount || 10, 
        location: '急診大廳', 
        labStatus: {}, 
        consents: {}, 
        reminders: [], 
        sosEnabled: false, 
        proxyEnabled: false, 
        isDischarged: false,
        dischargeCountdown: null // 加入初始值
    };
    return { ...defaultData, ...(patientsState[id] || {}) };
  };

  const updatePatientState = (id, data) => {
    // 嚴格取得當前 Firebase 狀態作為基底再合併
    const current = getPatientData(id);
    const updatedData = { ...current, ...data };
    set(ref(db, `patientsState/${id}`), updatedData);
  };

  const createAlert = (data) => {
    const id = Math.random().toString(36).substr(2, 9);
    set(ref(db, `alerts/${id}`), { id, ...data, timestamp: Date.now(), status: 'pending' });
  };

  const resolveAlert = (id) => {
    remove(ref(db, `alerts/${id}`));
  };

  const clearAllAlerts = () => {
    remove(ref(db, 'alerts'));
    remove(ref(db, 'commands'));
  };

  const createCommand = (data) => {
    const id = Math.random().toString(36).substr(2, 9);
    set(ref(db, `commands/${id}`), { id, ...data, timestamp: Date.now() });
  };

  const ackCommand = (id) => {
    remove(ref(db, `commands/${id}`));
  };

  const updateSystemConfig = (newConfig) => {
    set(ref(db, 'systemConfig'), newConfig);
  };

  const toggleSetting = (key) => setSettings(s => ({...s, [key]: !s[key]}));
  const globalClass = `min-h-screen bg-[#FDFBF7] dark:bg-slate-950 flex flex-col font-sans transition-colors duration-500 text-slate-800 dark:text-slate-200`;

  return (
    <div className={globalClass}>
      <style>{`
        html { font-size: 16px; transition: font-size 0.3s ease; }
        html.elder-mode { font-size: 26px !important; }
        
        .map-label-scale { transform: scale(1.5); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .map-label-scale.active-dest { transform: scale(3.5); }
        html.elder-mode .map-label-scale { transform: scale(2.0); }
        html.elder-mode .map-label-scale.active-dest { transform: scale(4.5); }
        
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: marquee 25s linear infinite; }
        @keyframes pathDash { from { stroke-dashoffset: 20; } to { stroke-dashoffset: 0; } }
        .animate-path-dash { animation: pathDash 1s linear infinite; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {!role && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 rounded-[1.5rem] flex items-center justify-center text-emerald-600 shadow-inner mb-6 border border-emerald-200"><Icon name="📈" size={48} /></div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-widest text-center">急診智能導航系統</h1>
          <div className="bg-emerald-50 text-emerald-600 font-bold px-4 py-1.5 rounded-full border border-emerald-100 text-sm mb-10"> Firebase 雲端連線穩定版 V62.8</div>

          <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[2.5rem] shadow-xl flex flex-col items-center hover:border-sky-400 transition-all">
               <Icon name="📱" size={64} className="text-sky-500 mb-4" />
               <h2 className="text-2xl font-black dark:text-white mb-2">一般使用者端</h2>
               <p className="text-slate-400 text-sm text-center mb-8">病患專屬導航與家屬授權探視。</p>
               <div className="w-full space-y-3">
                  <button onClick={() => setRole('patient_verify')} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-4 rounded-2xl font-black text-lg shadow-md transition-all flex items-center justify-center gap-2"><Icon name="🏥" size={24}/> 病患本人登入</button>
                  <button onClick={() => setRole('family_select')} className="w-full bg-amber-50 hover:bg-amber-100 text-amber-600 py-4 rounded-2xl font-black text-lg border border-amber-200 transition-all flex items-center justify-center gap-2"><Icon name="👥" size={24}/> 家屬探視登入</button>
               </div>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 rounded-[2.5rem] shadow-xl flex flex-col items-center hover:border-indigo-400 transition-all">
               <Icon name="🖥️" size={64} className="text-indigo-500 mb-4" />
               <h2 className="text-2xl font-black dark:text-white mb-2">醫療護理端</h2>
               <p className="text-slate-400 text-sm text-center mb-8">全區病患動態監控、發送廣播與接收任務。</p>
               <div className="w-full space-y-3">
                  <button onClick={() => { setStaffTarget('station'); setRole('staff_login'); }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-lg shadow-md transition-all flex items-center justify-center gap-2"><Icon name="💻" size={24}/> 護理站主控台</button>
                  <button onClick={() => { setStaffTarget('nurse_mobile'); setRole('staff_login'); }} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg border border-slate-200 transition-all flex items-center justify-center gap-2"><Icon name="📲" size={24}/> 護理師公務機</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {role === 'staff_login' && (
        <StaffLogin target={staffTarget} onLogin={(name) => { setSelectedNurse(name); setRole(staffTarget); }} onBack={() => setRole(null)} />
      )}

      {(role === 'patient_verify' || role === 'family_select') && (
        <div className="flex-1 p-6 overflow-y-auto animate-fade-in">
          <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
             <button onClick={() => setRole(null)} className="flex items-center gap-2 text-slate-500 font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-sm"><Icon name="◀️" size={16}/> 返回</button>
             <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
          </header>
          <h2 className="text-3xl font-black mb-8 dark:text-white text-center">請選擇模擬對象 (70 位)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {PATIENTS_LIST.map(p => (
              <button key={p.id} onClick={() => { setSelectedPatient(p); setRole(role === 'patient_verify' ? 'patient_login' : 'family_app'); }} className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 hover:border-sky-500 transition-all text-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center font-black mx-auto mb-2 text-slate-700 dark:text-white text-lg">{p.bed}</div>
                <div className="font-bold dark:text-white">{p.name}</div>
                <div className="text-[10px] text-slate-400 font-mono uppercase mt-1">{p.id}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {role === 'patient_login' && selectedPatient && (
        <PatientLogin patient={selectedPatient} settings={settings} onSuccess={() => setRole('patient_app')} onBack={() => setRole('patient_verify')} />
      )}

      {(role === 'patient_app' || role === 'family_app') && selectedPatient && (
        <PatientApp 
          patient={selectedPatient} 
          state={getPatientData(selectedPatient.id)} 
          settings={settings} toggleSetting={toggleSetting} onLogout={() => setRole(null)} 
          createAlert={createAlert} commands={commands} ackCommand={ackCommand} systemConfig={systemConfig} 
          isFamily={role === 'family_app'} 
          isProxy={getPatientData(selectedPatient.id).proxyEnabled} 
          alerts={alerts} resolveAlert={resolveAlert} updatePatientState={updatePatientState} 
        />
      )}
      {(role === 'station' || role === 'nurse_mobile') && (
        <NurseApp role={role} nurseName={selectedNurse} patientsState={patientsState} updatePatientState={updatePatientState} getPatientData={getPatientData} alerts={alerts} resolveAlert={resolveAlert} createAlert={createAlert} commands={commands} createCommand={createCommand} ackCommand={ackCommand} settings={settings} toggleSetting={toggleSetting} onLogout={() => setRole(null)} setSystemConfig={updateSystemConfig} clearAllAlerts={clearAllAlerts} systemConfig={systemConfig} />
      )}
    </div>
  );
}

function StaffLogin({ target, onLogin, onBack }) {
  const [account, setAccount] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (account && pwd) {
      const roleName = target === 'station' ? `主控台 (${account})` : `${account} 護理師`;
      onLogin(roleName);
    } else {
      setError('請輸入帳號與密碼');
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in bg-slate-50/50 dark:bg-slate-900/50">
       <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl w-full max-w-sm border border-slate-100 flex flex-col items-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-inner ${target === 'station' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
             <Icon name={target === 'station' ? "💻" : "📲"} size={40} />
          </div>
          <h2 className="text-2xl font-black mb-6 dark:text-slate-200">{target === 'station' ? '護理站主控台登入' : '公務機系統登入'}</h2>
          <form onSubmit={handleLogin} className="w-full space-y-4">
            <input type="text" placeholder="員工員編 / 帳號 (可隨意輸入)" value={account} onChange={e=>setAccount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors" />
            <input type="password" placeholder="密碼" value={pwd} onChange={e=>setPwd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl font-bold text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors" />
            {error && <p className="text-rose-500 text-sm font-bold text-center animate-pulse">{error}</p>}
            <button type="submit" className={`w-full text-white py-4 rounded-2xl font-black shadow-lg mt-4 transition-all active:scale-95 ${target === 'station' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-800'}`}>登入系統</button>
          </form>
          <button onClick={onBack} className="mt-8 text-slate-400 font-bold text-sm">取消返回</button>
       </div>
    </div>
  );
}

function PatientLogin({ patient, onSuccess, onBack, settings }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  
  const handleVerify = () => {
    if (pin === patient.idLast4) {
      if (settings.voice && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); const msg = new SpeechSynthesisUtterance(`身分驗證成功，歡迎使用急診智能導航系統。`); msg.lang = 'zh-TW'; window.speechSynthesis.speak(msg); }
      onSuccess();
    } else { setError(true); setPin(''); setTimeout(() => setError(false), 1000); }
  };
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in bg-slate-50/50 dark:bg-slate-900/50">
       <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl w-full max-w-sm border border-slate-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mb-6"><Icon name="🔒" size={32}/></div>
          <h2 className="text-2xl font-black mb-2 dark:text-slate-200">請輸入身分驗證</h2>
          <p className="text-slate-400 text-sm mb-10">請輸入病患 <span className="font-bold text-slate-800 dark:text-slate-200">{patient.name}</span> 的身分證字號末四碼 (預設: 0000)。</p>
          <div className="w-full flex gap-3 mb-8">
             {Array.from({length: 4}).map((_, i) => (<div key={i} className={`flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black ${pin.length > i ? 'border-sky-500 bg-sky-50 text-sky-600' : error ? 'border-rose-500' : 'border-slate-100 text-transparent'}`}>●</div>))}
          </div>
          <div className="grid grid-cols-3 gap-2 w-full mb-8">
             {[1,2,3,4,5,6,7,8,9, 'C', 0, 'OK'].map(n => (
                <button key={n} onClick={() => { if (n === 'C') setPin(''); else if (n === 'OK') handleVerify(); else if (pin.length < 4) setPin(pin + n); }} className={`h-12 rounded-xl font-black text-xl active:scale-90 transition-transform ${n==='OK'?'bg-sky-500 text-white col-span-1':'bg-slate-50 text-slate-700'}`}>{n}</button>
             ))}
          </div>
          <button onClick={onBack} className="text-slate-400 font-bold text-sm">取消返回</button>
       </div>
    </div>
  );
}

function PatientApp({ patient, state, settings, toggleSetting, onLogout, createAlert, commands, ackCommand, systemConfig, isFamily, isProxy, alerts, resolveAlert, updatePatientState }) {
  const [activeTab, setActiveTab] = useState('progress');
  const [activeDest, setActiveDest] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [zoom, setZoom] = useState(0.7);
  const [openFaq, setOpenFaq] = useState(null);
  const [navGuideText, setNavGuideText] = useState('');
  
  const [recallNotify, setRecallNotify] = useState(null);
  const [showUrgentCall, setShowUrgentCall] = useState(false);
  const [activeConsent, setActiveConsent] = useState(null); 
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const cmd = commands.find(c => c.patientId === patient.id);
    if (cmd) {
       if (settings.vibe && navigator.vibrate) navigator.vibrate([500, 200, 500]);
       
       if (MAP_LANDMARKS[cmd.action]) { 
          handleStartNav(cmd.action);
          setRecallNotify({
             title: cmd.action === 'nurse' ? '護理站正在找您' : '單位正在呼叫您',
             desc: `請跟隨導航前往 ${MAP_LANDMARKS[cmd.action].label}。`,
             icon: MAP_LANDMARKS[cmd.action].icon,
             color: 'bg-sky-600'
          });
          setTimeout(() => setRecallNotify(null), 8000);
       } else if (cmd.action === 'urgent_call') {
          setShowUrgentCall(true);
          if (settings.voice && 'speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const msg = new SpeechSynthesisUtterance(`${patient.name}！輪到您了！請立刻前往看診區看診。`);
              msg.lang = 'zh-TW'; window.speechSynthesis.speak(msg);
          }
       }
       ackCommand(cmd.id); 
    }
  }, [commands, patient.id, settings.vibe, settings.voice, ackCommand]);

  const handleStartNav = (destId) => {
    setActiveTab('nav'); setActiveDest(destId);
    const landmark = MAP_LANDMARKS[destId];
    if (landmark) {
      const guide = landmark.guide || `正在為您導航至${landmark.label}。請跟隨地圖指示前進。`;
      setNavGuideText(guide);
      if (settings.voice && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(guide);
        msg.lang = 'zh-TW'; window.speechSynthesis.speak(msg);
      }
    }
  };

  const isRequesting = (type) => alerts.some(a => a.patientId === patient.id && a.type === type);
  
  const handleToggleRequest = (type, message) => {
    const existing = alerts.find(a => a.patientId === patient.id && a.type === type);
    if (existing) {
       resolveAlert(existing.id);
       if (type === 'toilet' || type === 'away') updatePatientState(patient.id, { location: '急診大廳' });
    } else {
       if (settings.vibe && navigator.vibrate) navigator.vibrate(50); 
       createAlert({ patientId: patient.id, type, message });
       if (type === 'toilet') updatePatientState(patient.id, { location: '洗手間' });
       if (type === 'away') updatePatientState(patient.id, { location: '暫時離開' });
    }
  };

  useEffect(() => {
    let timer;
    if (isRequesting('toilet') || isRequesting('away')) {
       timer = setTimeout(() => {
          const alert = alerts.find(a => a.patientId === patient.id && (a.type === 'toilet' || a.type === 'away'));
          if (alert) {
             resolveAlert(alert.id); updatePatientState(patient.id, { location: '急診大廳' });
             if (settings.voice && 'speechSynthesis' in window) { 
                 const msg = new SpeechSynthesisUtterance(`系統偵測您已回到座位，狀態已解除。`); msg.lang = 'zh-TW'; window.speechSynthesis.speak(msg); 
             }
          }
       }, 20000); 
    }
    return () => clearTimeout(timer);
  }, [alerts, patient.id, settings.voice, resolveAlert, updatePatientState, isRequesting]);

  const triage = getTriageStyle(patient.triageLevel);

  if (state.isDischarged) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-xl text-center border border-slate-200">
           <Icon name="🔒" size={48} className="text-slate-300 mb-6"/>
           <h2 className="text-2xl font-black mb-4 dark:text-slate-200">就診紀錄已結案</h2>
           <p className="text-slate-500 font-bold mb-8">病患已完成離院手續，為保護隱私，專屬連結已自動註銷失效。</p>
           <button onClick={onLogout} className="bg-sky-500 text-white font-bold py-3 px-8 rounded-xl">返回系統首頁</button>
        </div>
      </div>
    );
  }

  const currentLocationCoords = state.location === '洗手間' ? { row: 8, col: 1 } : { row: 7, col: 4 };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden relative animate-fade-in">
      {toast && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl font-bold border-2 border-emerald-500 animate-bounce">{toast}</div>}

      {recallNotify && (
        <div className="absolute top-16 left-4 right-4 z-[90] animate-fade-in">
           <div className={`${recallNotify.color} backdrop-blur-xl border border-white/30 rounded-2xl p-5 shadow-2xl flex items-start gap-4`}>
              <div className="text-4xl animate-bounce"><Icon name={recallNotify.icon} size={36}/></div>
              <div className="text-white flex-1"><h3 className="font-black text-xl mb-1">{recallNotify.title}</h3><p className="font-bold text-sm opacity-95">{recallNotify.desc}</p></div>
              <button onClick={() => setRecallNotify(null)} className="text-white/70 hover:text-white"><Icon name="❌" size={20}/></button>
           </div>
        </div>
      )}
      {showUrgentCall && (
        <div className="absolute inset-0 z-[100] bg-rose-600 flex flex-col items-center justify-center p-6 animate-pulse">
           <Icon name="⚠️" size={120} className="text-white mb-6" />
           <h2 className="text-5xl font-black text-white mb-4">輪到您了！</h2>
           <p className="text-2xl text-white text-center mb-10 font-bold">請立刻前往看診區看診</p>
           <button onClick={() => setShowUrgentCall(false)} className="bg-white text-rose-600 font-black text-3xl py-5 px-12 rounded-3xl shadow-2xl active:scale-95 transition-transform">我知道了</button>
        </div>
      )}

      {activeConsent && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[3rem] p-8 shadow-2xl flex flex-col items-center text-center relative">
              <button onClick={()=>setActiveConsent(null)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full"><Icon name="❌" size={16}/></button>
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-4"><Icon name="✍️" size={32}/></div>
              <h3 className="text-xl font-black dark:text-white mb-2">{activeConsent === 'ct' ? 'CT 檢查同意書' : '住院同意書'}</h3>
              <p className="text-slate-400 text-sm mb-6">請詳閱說明後進行數位簽署。</p>
              <div className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center text-slate-400 font-bold mb-6">請在此處簽名</div>
              <button onClick={() => {
                 updatePatientState(patient.id, { consents: { ...state.consents, [activeConsent]: 'signed' } });
                 setActiveConsent(null);
                 showToast('同意書已完成遠距電子簽署！');
                 if (settings.voice && 'speechSynthesis' in window) {
                     const msg = new SpeechSynthesisUtterance(`同意書已簽署完成。`);
                     msg.lang = 'zh-TW'; window.speechSynthesis.speak(msg);
                 }
              }} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95">確認簽署</button>
           </div>
        </div>
      )}

      <div className="bg-sky-600 text-white h-10 flex items-center px-4 overflow-hidden relative z-[60] shadow-sm shrink-0">
        <Icon name="ℹ️" size={16} className="mr-2"/><div className="animate-marquee whitespace-nowrap text-sm font-bold tracking-widest uppercase">{systemConfig.marqueeText}</div>
      </div>

      <header className="p-4 border-b flex justify-between items-center shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-50">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Icon name="📈" size={20} className="text-rose-500"/> <h1 className="text-lg font-black text-sky-600">某某醫學中心</h1>
            {isFamily && isProxy && <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-md ml-2 border border-purple-200">代理操作中</span>}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-3xl font-black dark:text-white tracking-tight">{patient.name}</h2>
            <div className="bg-emerald-50 text-emerald-600 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1 shadow-sm"><Icon name="📍" size={12}/> 即時定位</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
          <button onClick={onLogout} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl ml-1"><Icon name="🚪" size={18}/></button>
        </div>
      </header>

      {!isFamily && (
        <div className="px-4 py-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button onClick={()=>setShowShareModal(true)} className="w-full bg-indigo-50/80 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-indigo-100 dark:border-indigo-800 shadow-sm active:scale-95 transition-transform">
             <Icon name="🔗" size={18}/> 點擊產生家屬探視連結
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50 scroll-smooth pb-10">
        {activeTab === 'progress' && (
          <div className="p-4 space-y-5 animate-fade-in">
            {state.consents?.ct === 'pending' && (
               <div className="bg-purple-50 border-2 border-purple-300 p-6 rounded-[2.5rem] shadow-md mb-2 animate-bounce">
                  <div className="flex items-center gap-3 text-purple-700 font-black mb-4"><Icon name="📝" size={28}/> CT 電腦斷層檢查同意書待簽署</div>
                  <SwipeToConfirm text="滑動以簽署同意書" onConfirm={() => setActiveConsent('ct')} bgClass="bg-purple-200" textClass="text-purple-700" icon={<Icon name="▶️" size={16}/>} />
               </div>
            )}

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center gap-2 mb-6">
                  <Icon name="📈" size={18} className="text-sky-500"/>
                  <h3 className="font-black text-lg text-sky-700 dark:text-sky-400">就診流程</h3>
               </div>
               <div className="flex justify-between items-center relative px-2">
                  <div className="absolute left-4 right-4 top-[15px] h-[3px] bg-slate-100 -z-0"></div>
                  <div className="absolute left-4 top-[15px] h-[3px] bg-sky-500 -z-0 transition-all duration-700 shadow-[0_0_8px_#0ea5e9]" style={{width: `${(state.currentStep - 1) * 25}%`}}></div>
                  {MED_STEPS.map((s, i) => {
                    const active = i + 1 === state.currentStep;
                    const done = i + 1 < state.currentStep;
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-sky-500 border-sky-500 text-white' : active ? 'bg-white border-sky-500 text-sky-500 shadow-md scale-110' : 'bg-white border-slate-200 text-slate-300'}`}>
                           {done ? <Icon name="✅" size={14}/> : i + 1}
                        </div>
                        <span className={`text-[10px] font-bold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{s}</span>
                      </div>
                    );
                  })}
               </div>
            </div>

            <div className="bg-gradient-to-br from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 p-8 rounded-[3rem] border-2 border-sky-100 dark:border-sky-900 shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Icon name="📈" size={120}/></div>
               <div className="flex justify-between items-end mb-6">
                  <div className="flex flex-col">
                     <span className="text-7xl font-black text-amber-500 dark:text-amber-400 leading-none drop-shadow-sm">{state.waitingCount}</span>
                     <span className="text-sm font-bold text-slate-400 tracking-widest uppercase mt-3">前方等待人數</span>
                  </div>
                  <div className="text-right">
                     <div className={`text-xs font-black px-3 py-1.5 rounded-full mb-2 inline-block border ${triage.bg} ${triage.color} ${triage.border}`}>{triage.name}</div>
                  </div>
               </div>
               <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-sky-500 animate-pulse shadow-[0_0_10px_#0ea5e9]" style={{width: '65%'}}></div>
               </div>
               <p className="mt-6 text-2xl font-black text-slate-800 dark:text-white tracking-tight">{state.currentStatus}</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center gap-2 mb-6"><Icon name="📄" size={18} className="text-slate-500"/><h3 className="font-black text-lg text-slate-700 dark:text-slate-300">檢驗與報告進度</h3></div>
               <div className="space-y-4">
                 {LAB_TYPES.map(lab => {
                   const s = state.labStatus[lab.id];
                   if (!s || s.status === 'none') return null;
                   const isDone = s.status === 'done' || s.status === 'reported';
                   return (
                     <div key={lab.id} className="animate-fade-in bg-slate-50 dark:bg-slate-700 p-4 rounded-2xl border border-slate-100 dark:border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm"><Icon name={lab.icon || '📄'} size={20} className={lab.colorCls.split(' ')[0]}/></div>
                              <div><div className="font-black text-base dark:text-white">{lab.label}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">{isDone ? '完成' : '處理中'}</div></div>
                           </div>
                           <div className={`font-black text-sm ${isDone ? 'text-emerald-500' : 'text-sky-500'}`}>{s.text}</div>
                        </div>
                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${isDone ? 'bg-emerald-500 w-full' : 'bg-sky-500 w-1/2 animate-pulse'}`}></div></div>
                     </div>
                   );
                 })}
                 {(!state.labStatus || Object.values(state.labStatus).every(s => s.status === 'none' || !s.status)) && <div className="text-center py-10 text-slate-300 font-bold italic">目前尚未開立任何檢驗</div>}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'nav' && (
          <div className="flex flex-col h-full animate-fade-in relative pt-4">
            <div className="flex-1 bg-slate-200 dark:bg-slate-800 mx-4 rounded-3xl relative overflow-hidden shadow-inner border border-white/50 min-h-[300px]">
              <div className="absolute top-4 right-4 z-[70] flex flex-col gap-2">
                <button onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))} className="bg-white p-2.5 rounded-xl shadow-lg active:scale-95"><Icon name="➕" size={20}/></button>
                <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))} className="bg-white p-2.5 rounded-xl shadow-lg active:scale-95"><Icon name="➖" size={20}/></button>
                <button onClick={() => {setZoom(0.7); setActiveDest(null); setNavGuideText('');}} className="bg-white p-2.5 rounded-xl shadow-lg active:scale-95"><Icon name="🎯" size={20}/></button>
              </div>

              <div className="absolute inset-0 flex items-center justify-center cursor-move" style={{ transform: `scale(${zoom})`, transition: 'transform 0.25s ease-out' }}>
                <div className="relative flex flex-col" style={{ transform: 'rotateX(55deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}>
                  {MAP_LAYOUT_1F.map((rowArr, rIdx) => (
                    <div key={rIdx} className="flex" style={{ transformStyle: 'preserve-3d' }}>
                      {rowArr.map((cell, cIdx) => {
                        let landmark = null;
                        Object.entries(MAP_LANDMARKS).forEach(([id, data]) => {
                          if (data.row === rIdx && data.col === cIdx) landmark = { id, ...data };
                        });
                        const isActive = activeDest === landmark?.id;
                        const isCurrentLocation = currentLocationCoords.row === rIdx && currentLocationCoords.col === cIdx;
                        
                        return (
                          <div key={cIdx} className={`w-12 h-12 border border-slate-300 relative transition-all ${landmark?.color || (cell === 2 ? 'bg-slate-400' : cell === 3 ? 'bg-amber-100' : cell === 4 ? 'bg-sky-100' : 'bg-white dark:bg-slate-700')}`}>
                            
                            {isCurrentLocation && (
                              <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ transform: 'translateZ(20px) rotateZ(45deg) rotateX(-55deg)', zIndex: 60 }}>
                                <div className="map-label-scale flex flex-col items-center origin-bottom animate-bounce">
                                  <div className="bg-emerald-500 text-white text-[15px] font-black px-4 py-2 rounded-full shadow-lg border-2 border-white tracking-widest whitespace-nowrap">📍 目前位置</div>
                                  <div className="w-1 h-12 bg-emerald-500"></div>
                                </div>
                              </div>
                            )}

                            {landmark && (
                              <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ transform: `translateZ(${isActive ? '220px' : '70px'}) rotateZ(45deg) rotateX(-55deg)`, zIndex: isActive ? 9999 : 40 }}>
                                <div className={`map-label-scale flex flex-col items-center origin-bottom ${isActive ? 'active-dest animate-bounce' : ''}`}>
                                  <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl border-4 min-w-[150px] justify-center shadow-2xl transition-all ${isActive ? 'bg-sky-500 text-white border-white scale-125' : 'bg-white/95 border-slate-300 text-slate-800'}`}>
                                    <span className={isActive ? "text-4xl" : "text-2xl"}>{landmark.icon}</span>
                                    <span className={`font-black leading-tight text-center tracking-widest ${isActive ? "text-[26px]" : "text-[16px]"}`}>{landmark.label}</span>
                                  </div>
                                  <div className={`w-2 ${isActive ? 'h-32 bg-gradient-to-t from-sky-500/0 to-sky-500 shadow-[0_0_20px_#0ea5e9]' : 'h-12 bg-slate-400'}`}></div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {activeDest && MAP_LANDMARKS[activeDest]?.navPath && (
                    <svg className="absolute inset-0 z-30 pointer-events-none" style={{ transform: 'translateZ(1px)', width: '100%', height: '100%' }}>
                       <polyline points={MAP_LANDMARKS[activeDest].navPath} fill="none" stroke="#0ea5e9" strokeWidth="8" strokeDasharray="12 12" className="animate-path-dash" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {navGuideText && (
               <div className="bg-sky-50 p-4 mx-4 mt-4 rounded-2xl flex items-start gap-3 shrink-0 shadow-sm border border-sky-100 animate-fade-in">
                  <div className="bg-white p-2 rounded-full shadow-sm mt-0.5"><Icon name="🧭" size={20}/></div>
                  <p className="text-sky-800 font-bold leading-relaxed text-[15px]">{navGuideText}</p>
               </div>
            )}

            <div className="bg-white/95 py-4 px-2 shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] mt-4">
               <p className="text-xs font-black text-slate-400 mb-3 tracking-widest uppercase px-3">您要去哪裡？</p>
               <div className="flex gap-3 overflow-x-auto pb-4 pt-2 no-scrollbar px-2">
                  {NAV_DESTINATIONS.map(d => (
                    <button key={d.id} onClick={() => handleStartNav(d.id)} className={`px-6 py-4 rounded-3xl shrink-0 border-[3px] font-black text-base flex flex-col items-center justify-center gap-3 min-w-[110px] transition-all active:scale-95 ${activeDest === d.id ? 'bg-sky-50 text-sky-700 border-sky-400 shadow-xl scale-110' : 'bg-white text-slate-600 border-slate-200 shadow-sm hover:bg-slate-50'}`}>
                      <Icon name={d.icon} size={36}/> <span>{d.label}</span>
                    </button>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="p-4 space-y-6 animate-fade-in pb-24">
             {isFamily && !isProxy ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center bg-slate-50 dark:bg-slate-800 rounded-[3rem] border border-slate-200 dark:border-slate-700 mt-4">
                   <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded-full flex items-center justify-center mb-6 shadow-inner"><Icon name="🔒" size={48} /></div>
                   <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-3">權限限制</h3>
                   <p className="text-slate-500 font-bold leading-relaxed">
                      此為病患本人專屬之求助與設定功能。<br/>
                      若病患重症無法自行操作介面，<br/>
                      請向護理站申請<strong className="text-purple-600 mx-1">「開啟代理」</strong>權限。
                   </p>
                </div>
             ) : (
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { id: 'toilet', label: '去廁所', icon: '🚽', message: '🚽 病患暫離：前往洗手間' },
                     { id: 'iv', label: '點滴沒了', icon: '💧', message: '💧 點滴快沒了/不滴' },
                     { id: 'bleeding', label: '點滴漏血', icon: '🩹', message: '🩹 點滴處滲血/會痛' },
                     { id: 'other', label: '其他需求', icon: '💬', message: '❓ 病患有其他需求' }
                   ].map(item => {
                     const active = isRequesting(item.id);
                     const isReturnable = item.id === 'toilet';
                     return (
                       <button key={item.id} onClick={()=>handleToggleRequest(item.id, item.message)} className={`p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center gap-3 transition-all active:scale-95 group relative overflow-hidden ${active ? 'bg-rose-50 border-rose-200' : 'bg-white dark:bg-slate-800'}`}>
                          <span className="text-4xl">{item.icon}</span>
                          <span className={`font-black text-lg ${active ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>{active ? (isReturnable ? '我已返回' : '處理中...') : item.label}</span>
                          {active && <div className="absolute top-2 right-3 text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">鎖定中</div>}
                       </button>
                     );
                   })}
                   <div className="col-span-2 relative mt-2">
                      <button disabled={!state.sosEnabled || isRequesting('sos')} onClick={()=>handleToggleRequest('sos', '🆘 緊急求救！')} className={`w-full p-8 rounded-[2.5rem] shadow-lg flex items-center justify-center gap-4 transition-all ${state.sosEnabled ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white animate-pulse active:scale-95' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-2 border-dashed border-slate-200 cursor-not-allowed grayscale'}`}>
                         <Icon name="🆘" size={40}/><span className="text-2xl font-black tracking-widest uppercase">{isRequesting('sos') ? '救援中' : '緊急求助 SOS'}</span>
                      </button>
                      {!state.sosEnabled && <div className="absolute top-3 right-6 bg-slate-700 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-md"><Icon name="🔒" size={10}/> 需護理站開啟</div>}
                   </div>
                </div>
             )}
             
             <div className="space-y-3 mt-8 border-t pt-6">
                <div className="flex items-center gap-2 px-1 mb-2"><Icon name="❓" size={20} className="text-sky-500"/><h3 className="text-sm font-black text-sky-700 dark:text-sky-400">常見問題 Q&A</h3></div>
                {FAQS.map((f, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm transition-all">
                    <button onClick={()=>setOpenFaq(openFaq===i?null:i)} className="w-full p-4 flex justify-between items-center text-left gap-3 font-bold text-slate-800 dark:text-slate-200 text-[15px]">
                       <span className="flex items-center gap-3"><span className="text-emerald-500 bg-emerald-50 w-6 h-6 flex items-center justify-center rounded text-xs font-black shrink-0">Q</span> <span className="leading-snug">{f.q}</span></span>
                       <span className="text-slate-400"><Icon name={openFaq===i?'🔼':'🔽'} size={14}/></span>
                    </button>
                    {openFaq===i && <div className="p-4 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-600 flex gap-3 leading-relaxed text-sm animate-fade-in"><span className="text-amber-500 bg-amber-50 w-6 h-6 flex items-center justify-center rounded text-xs font-black shrink-0 mt-0.5">A</span><p className="font-bold">{f.a}</p></div>}
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <footer className="h-20 border-t bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex items-center justify-around px-4 pb-4 pt-2 shrink-0 z-[100] shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <button onClick={()=>setActiveTab('progress')} className={`flex flex-col items-center gap-1 w-1/3 py-2 rounded-2xl transition-all ${activeTab==='progress'?'text-sky-600 bg-sky-50':'text-slate-400'}`}><Icon name="📈" size={24}/><span className="text-[10px] font-black uppercase">看進度</span></button>
        <button onClick={()=>setActiveTab('nav')} className={`flex flex-col items-center gap-1 w-1/3 py-2 rounded-2xl transition-all ${activeTab==='nav'?'text-sky-600 bg-sky-50':'text-slate-400'}`}><Icon name="📍" size={24}/><span className="text-[10px] font-black uppercase">找路</span></button>
        <button onClick={()=>setActiveTab('help')} className={`flex flex-col items-center gap-1 w-1/3 py-2 rounded-2xl transition-all ${activeTab==='help'?'text-amber-600 bg-amber-50':'text-slate-400'}`}><Icon name="🤝" size={24}/><span className="text-[10px] font-black uppercase">要幫忙</span></button>
      </footer>

      {showShareModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl flex flex-col items-center text-center relative border border-white/20">
              <button onClick={()=>setShowShareModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full active:scale-90 transition-transform"><Icon name="❌" size={16}/></button>
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner"><Icon name="🔗" size={40}/></div>
              <h3 className="text-2xl font-black dark:text-white mb-2">家屬探視連結</h3>
              <p className="text-slate-400 text-sm mb-8 px-4 font-bold leading-relaxed">請家屬掃描條碼或複製網址，進入前需驗證身分證後四碼。</p>
              <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-100 mb-8 shadow-xl">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=er-omo.link/${patient.token}`} alt="QR" className="w-40 h-40"/>
              </div>
              
              {copySuccess ? (
                <div className="w-full bg-emerald-50 text-emerald-600 py-4 rounded-[1.5rem] font-black text-lg border border-emerald-200">✅ 連結已成功複製</div>
              ) : (
                <button onClick={()=>{
                   setCopySuccess(true); 
                   setTimeout(() => {setCopySuccess(false); setShowShareModal(false);}, 1500);
                }} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-[1.5rem] font-black text-lg shadow-lg active:scale-95 transition-all">複製分享連結</button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}

function NurseApp({ role, nurseName, patientsState, updatePatientState, getPatientData, alerts, resolveAlert, createAlert, commands, createCommand, ackCommand, settings, toggleSetting, onLogout, setSystemConfig, clearAllAlerts, systemConfig }) {
  const [page, setPage] = useState(1);
  const [zoneFilter, setZoneFilter] = useState('全區');
  const [statusFilter, setStatusFilter] = useState('全部狀態');
  const [searchKey, setSearchKey] = useState('');
  const [toast, setToast] = useState(null);
  
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showMultiBedModal, setShowMultiBedModal] = useState(false);
  const [showMarqueeModal, setShowMarqueeModal] = useState(false);

  const isStation = role === 'station';

  let filteredPatients = PATIENTS_LIST.filter(p => {
     const st = getPatientData(p.id);
     if (st.isDischarged && statusFilter !== '已結案') return false;
     if (!st.isDischarged && statusFilter === '已結案') return false;
     if (zoneFilter !== '全區' && p.zone !== zoneFilter) return false;
     if (statusFilter === '呼叫中' && !alerts.some(a => a.patientId === p.id)) return false;
     if (searchKey && !p.name.includes(searchKey) && !p.id.includes(searchKey) && !p.bed.includes(searchKey)) return false;
     return true;
  });
  const totalPages = Math.ceil(filteredPatients.length / 8) || 1;
  const displayPatients = filteredPatients.slice((page - 1) * 8, page * 8);

  const getZoneCount = (z) => PATIENTS_LIST.filter(p => z === '全區' ? true : p.zone === z).length;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const cycleLab = (pId, labId) => {
    const s = getPatientData(pId);
    const curr = s.labStatus[labId]?.status || 'none';
    const flow = { 'none': 'pending', 'pending': 'done', 'done': 'reported', 'reported': 'none' };
    const labels = { 'pending': '待檢', 'done': '完成', 'reported': '報告已出', 'none': '未開立' };
    
    let newStep = s.currentStep;
    let newStatus = s.currentStatus;
    let newConsents = { ...s.consents };

    if (curr === 'none') {
       newStep = Math.max(s.currentStep, 3);
       newStatus = '進行檢驗中';
       if (labId === 'ct') {
           newConsents.ct = 'pending';
           showToast('CT 檢驗已開立，同步派發電子同意書');
       }
    }

    updatePatientState(pId, { 
      currentStep: newStep,
      currentStatus: newStatus,
      consents: newConsents,
      labStatus: { ...s.labStatus, [labId]: { status: flow[curr], text: labels[flow[curr]] } } 
    });
  };
  
  const cancelLab = (pId, labId) => {
    const s = getPatientData(pId);
    const newLabs = {...s.labStatus}; delete newLabs[labId];
    updatePatientState(pId, { labStatus: newLabs }); showToast('已取消檢驗排單');
  };

  const toggleConsent = (pId, cType) => {
    const s = getPatientData(pId);
    const curr = s.consents[cType] || 'none';
    const next = curr === 'none' ? 'pending' : curr === 'pending' ? 'signed' : 'none';
    updatePatientState(pId, { consents: { ...s.consents, [cType]: next } });
  };

  const toggleReminder = (pId, rId) => {
    const s = getPatientData(pId);
    const has = s.reminders.includes(rId);
    const next = has ? s.reminders.filter(id=>id!==rId) : [...s.reminders, rId];
    updatePatientState(pId, { reminders: next });
    showToast(has ? '已取消語音廣播' : '已發送病床語音廣播');
  };

  const handleDischarge = (pId) => {
    updatePatientState(pId, { isDischarged: true, currentStatus: '已結案', dischargeCountdown: null }); 
    const patientAlerts = alerts.filter(a => a.patientId === pId);
    patientAlerts.forEach(a => resolveAlert(a.id));
    showToast('病患已離院結案，相關任務已銷毀');
  };

  const startDischargeTimer = (pId) => {
    updatePatientState(pId, { dischargeCountdown: 30, currentStatus: '批價離院倒數中' }); 
    showToast('已觸發批價離院倒數，30分鐘後自動結案');
  };

  const undoDischarge = (pId) => {
    updatePatientState(pId, { isDischarged: false, currentStatus: '等候醫師看診/開單', dischargeCountdown: null }); 
    showToast('已撤銷結案，恢復收治');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden relative font-sans text-slate-800 animate-fade-in">
      {toast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[1000] bg-slate-800 text-white px-8 py-3 rounded-full shadow-2xl font-bold border border-emerald-500 animate-fade-in">{toast}</div>}

      <header className="bg-indigo-50/80 border-b border-indigo-100 flex flex-col shrink-0 z-50">
        <div className="flex justify-between items-center px-6 py-3">
           <div className="flex items-center gap-3">
             <Icon name="🛡️" size={28}/>
             <div><h2 className="font-black text-xl">{isStation ? '護理站主控台' : '公務機任務中心'}</h2><p className="text-xs text-slate-500 font-bold">目前登入：{nurseName}</p></div>
           </div>
           <div className="flex items-center gap-4">
             <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
             <button onClick={onLogout} className="p-2 bg-slate-200 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><Icon name="🚪" size={20}/></button>
           </div>
        </div>
        {isStation && (
           <div className="flex gap-3 px-6 pb-4 flex-wrap relative z-[500]">
              <button onClick={() => setShowBroadcastModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm active:scale-95"><Icon name="📢" size={16}/> 全區緊急廣播</button>
              <button onClick={() => setShowMultiBedModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm active:scale-95"><Icon name="🚨" size={16}/> 大量病人呼叫</button>
              <button onClick={() => setShowMarqueeModal(true)} className="bg-sky-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm active:scale-95"><Icon name="ℹ️" size={16}/> 設定衛教跑馬燈</button>
              <button onClick={() => { clearAllAlerts(); showToast('已清空所有任務與警報'); }} className="bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm active:scale-95"><Icon name="🗑️" size={16}/> 任務全清 (測試)</button>
           </div>
        )}
      </header>

      <div className={`flex flex-1 overflow-hidden ${isStation ? 'flex-row' : 'flex-col'}`}>
        {isStation && (
           <main className="flex-1 flex flex-col overflow-hidden bg-white/50 relative">
              <div className="flex flex-wrap gap-4 items-center px-6 py-3 border-b bg-slate-50/80 shrink-0">
                 <div className="flex gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                    {['全區','看診區','兒科區','留觀區','重症區'].map(z => (
                      <button key={z} onClick={()=>setZoneFilter(z)} className={`px-4 py-1.5 rounded-md text-[13px] font-black transition-colors ${zoneFilter===z?'bg-slate-100 text-slate-800 shadow-inner':'text-slate-400 hover:text-slate-600'}`}>{z} ({getZoneCount(z)})</button>
                    ))}
                 </div>
                 <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex items-center px-3 overflow-hidden">
                    <Icon name="🔍" size={14} className="text-slate-400"/>
                    <input type="text" placeholder="搜尋姓名或病歷號或床號..." value={searchKey} onChange={e=>setSearchKey(e.target.value)} className="outline-none text-sm font-bold p-2 w-48 bg-transparent" />
                 </div>
                 <div className="flex gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-200">
                    {['全部狀態','呼叫中','已結案'].map(s => (
                      <button key={s} onClick={()=>setStatusFilter(s)} className={`px-4 py-1.5 rounded-md text-[13px] font-black flex items-center gap-1 transition-colors ${statusFilter===s?'bg-slate-100 text-slate-800 shadow-inner':'text-slate-400 hover:text-slate-600'}`}>
                         {s==='呼叫中'&&<Icon name="🔔" size={14}/>}{s==='已結案'&&<Icon name="🔒" size={14}/>} {s}
                      </button>
                    ))}
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6 content-start pb-24 scroll-smooth">
                 {displayPatients.map(p => {
                    const st = getPatientData(p.id);
                    const triage = getTriageStyle(p.triageLevel);
                    return (
                      <div key={p.id} className="bg-white rounded-[1.5rem] border border-slate-200 shadow-sm p-6 flex flex-col gap-4 transition-all hover:border-indigo-300 relative">
                         <div className="flex justify-between items-start">
                            <div className="flex gap-4">
                               <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black text-slate-700 shadow-inner">{p.bed}</div>
                               <div>
                                  <div className="flex items-center gap-2 mb-1">
                                     <h3 className="text-xl font-black tracking-widest">{p.name}</h3>
                                     <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${triage.color} ${triage.bg} ${triage.border}`}>{triage.name}</span>
                                  </div>
                                  <p className="text-[13px] font-bold text-sky-600 mb-1">{st.currentStatus}</p>
                                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                                     <span><Icon name="📍" size={12}/> {st.location}</span>
                                     <span><Icon name="⏳" size={12}/> 前方等待: {st.waitingCount}人</span>
                                  </div>
                               </div>
                            </div>
                            <div className="bg-slate-100 px-3 py-1 rounded-lg text-[11px] font-black text-slate-500">{p.zone}</div>
                         </div>

                         {st.isDischarged ? (
                            <div className="mt-2 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                               <p className="font-black text-slate-500 mb-3 text-lg"><Icon name="🔒" size={18}/> 病患已結案離院</p>
                               <button onClick={() => undoDischarge(p.id)} className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-black active:scale-95 transition-all flex items-center justify-center gap-2">
                                  <Icon name="🔄" size={16}/> 撤銷結案 (恢復收治)
                               </button>
                            </div>
                         ) : (
                            <>
                               <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                                  <button onClick={()=>createCommand({patientId:p.id, action:'urgent_call'})} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold border border-rose-100 flex items-center gap-1 active:scale-95"><Icon name="🔊" size={14}/> 強制叫號</button>
                                  <button onClick={()=>updatePatientState(p.id, {sosEnabled: !st.sosEnabled})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors ${st.sosEnabled?'bg-amber-100 text-amber-700 border-amber-300':'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>{st.sosEnabled?'已准SOS':'開放SOS'}</button>
                                  <button onClick={()=>updatePatientState(p.id, {proxyEnabled: !st.proxyEnabled})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors ${st.proxyEnabled?'bg-purple-100 text-purple-700 border-purple-300':'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}>
                                     <Icon name="👨‍⚖️" size={14}/> {st.proxyEnabled ? '已授權' : '授權代簽'}
                                  </button>
                                  <button onClick={()=>toggleConsent(p.id, 'admission')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${st.consents.admission==='pending'?'bg-emerald-50 text-emerald-600 border-emerald-200':st.consents.admission==='signed'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-slate-50 text-slate-400 border-slate-200'}`}>住院同意</button>
                                  {st.consents.ct && <button onClick={()=>toggleConsent(p.id, 'ct')} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${st.consents.ct==='pending'?'bg-purple-50 text-purple-600 border-purple-200':st.consents.ct==='signed'?'bg-purple-500 text-white border-purple-600':'bg-slate-50 text-slate-400 border-slate-200'}`}>CT同意書</button>}
                               </div>

                               <div className="pt-2">
                                  <div className="text-[11px] font-black text-slate-500 mb-2">檢驗開立與排單控制</div>
                                  <div className="flex flex-wrap gap-2">
                                     {LAB_TYPES.map(lab => {
                                        const lState = st.labStatus[lab.id]?.status || 'none';
                                        const isActive = lState !== 'none';
                                        const btnStyle = isActive ? lab.colorCls : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100';
                                        return (
                                          <div key={lab.id} className="flex rounded-md overflow-hidden border border-transparent shadow-sm">
                                             <button onClick={()=>cycleLab(p.id, lab.id)} className={`px-2 py-1 text-[11px] font-bold border transition-colors border-r-0 ${isActive?'rounded-l-md':'rounded-md'} ${btnStyle}`}>
                                                {lab.label} {isActive ? `[${st.labStatus[lab.id].text}]` : '[未開]'}
                                             </button>
                                             {isActive && (
                                                <button onClick={()=>cancelLab(p.id, lab.id)} className={`px-1.5 flex items-center justify-center border-l transition-colors rounded-r-md ${btnStyle} hover:brightness-95`}><Icon name="❌" size={10} /></button>
                                             )}
                                          </div>
                                        );
                                     })}
                                  </div>
                               </div>

                               <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 mt-2">
                                  <button onClick={()=>createCommand({patientId: p.id, action:'nurse'})} className="py-2.5 bg-cyan-50/50 text-indigo-700 rounded-xl border border-cyan-100 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 hover:bg-cyan-100"><Icon name="📞" size={14}/> 導航回站</button>
                                  <button onClick={()=>createCommand({patientId: p.id, action:'xray'})} className="py-2.5 bg-cyan-50/50 text-teal-700 rounded-xl border border-cyan-100 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 hover:bg-cyan-100"><Icon name="📲" size={14}/> 去 X 光</button>
                               </div>
                               
                               <div className="col-span-2 pt-2 space-y-2">
                                  {st.dischargeCountdown !== null && st.dischargeCountdown !== undefined ? (
                                      <button onClick={() => undoDischarge(p.id)} className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-300 rounded-xl font-black active:scale-95 transition-all flex items-center justify-center gap-2">
                                         <Icon name="💳" size={16}/> 已觸發繳費，{st.dischargeCountdown} 分鐘自動結案倒數中 (點擊撤銷)
                                      </button>
                                  ) : (
                                      <>
                                          <SwipeToConfirm text="滑動以離院結案" onConfirm={()=>handleDischarge(p.id)} bgClass="bg-rose-50 border border-rose-100" textClass="text-rose-600" />
                                          <button onClick={() => startDischargeTimer(p.id)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md">
                                              <Icon name="💳" size={16}/> 批價模擬出院 (30分鐘倒數)
                                          </button>
                                      </>
                                  )}
                               </div>
                            </>
                         )}
                      </div>
                    );
                 })}
              </div>
              
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur-xl p-3 rounded-2xl shadow-xl border border-slate-200">
                 <button disabled={page === 1} onClick={() => setPage(page - 1)} className="p-2 bg-slate-100 rounded-xl disabled:opacity-30 active:scale-90"><Icon name="◀️" size={18}/></button>
                 <span className="font-black text-sm px-4">第 {page} / {totalPages} 頁</span>
                 <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="p-2 bg-slate-100 rounded-xl disabled:opacity-30 active:scale-90"><Icon name="▶️" size={18}/></button>
              </div>
           </main>
        )}

        <aside className={`${isStation ? 'w-[320px] shrink-0 border-l border-slate-200' : 'w-full'} bg-slate-50 p-6 flex flex-col h-full`}>
           <h3 className="text-[15px] font-black text-rose-500 mb-6 flex items-center gap-2"><Icon name="🔔" size={20}/> {isStation ? '緊急呼叫' : '任務佇列'} ({alerts.length})</h3>
           <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-10">
             {alerts.map(a => <AlertTaskCard key={a.id} alert={a} isStation={isStation} resolveAlert={resolveAlert} showToast={showToast} /> )}
             {alerts.length === 0 && <div className="text-center py-20 text-slate-400 font-bold text-sm">目前無任務</div>}
           </div>
        </aside>
      </div>

      {showBroadcastModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-start justify-center pt-20 px-6 animate-fade-in">
           <div className="bg-white w-full max-w-xl rounded-[2rem] p-8 shadow-2xl flex flex-col border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-orange-600 flex items-center gap-3"><Icon name="📢" size={24}/> 全區緊急廣播</h3>
                 <button onClick={() => setShowBroadcastModal(false)} className="p-2 bg-slate-100 rounded-full active:scale-90 transition-transform"><Icon name="❌" size={14}/></button>
              </div>
              <div className="space-y-4">
                 <select onChange={(e) => { if(e.target.value){ showToast(`已發送廣播：${e.target.value}`); setShowBroadcastModal(false); } }} className="w-full p-4 rounded-xl border-2 border-orange-200 bg-orange-50 font-bold text-orange-800 outline-none">
                    <option value="">-- 選擇廣播模版 --</option>
                    <option value="啟動大量傷患機制 (代號333)，請各單位待命">🚨 啟動大量傷患機制 (代號333)</option>
                    <option value="急診發生醫療暴力事件，請保安警衛立刻前往支援">🚨 急診發生醫療暴力事件</option>
                    <option value="院區發生火警，請所有人聽從護理人員指示就地避難">🚨 院區發生火警，就地避難</option>
                 </select>
                 <div className="flex gap-2">
                    <input type="text" placeholder="自訂廣播內容..." id="customBroadcast" className="flex-1 border-2 border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-orange-400" />
                    <button onClick={() => { const v = document.getElementById('customBroadcast').value; if(v) { showToast(`已發送廣播：${v}`); setShowBroadcastModal(false); } }} className="bg-orange-600 text-white font-black px-6 rounded-xl whitespace-nowrap active:scale-95">發送</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showMarqueeModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-start justify-center pt-20 px-6 animate-fade-in">
           <div className="bg-white w-full max-w-xl rounded-[2rem] p-8 shadow-2xl flex flex-col border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black text-sky-600 flex items-center gap-3"><Icon name="ℹ️" size={24}/> 設定衛教跑馬燈模版</h3>
                 <button onClick={() => setShowMarqueeModal(false)} className="p-2 bg-slate-100 rounded-full active:scale-90 transition-transform"><Icon name="❌" size={14}/></button>
              </div>
              <div className="space-y-4">
                 <select onChange={(e) => { if(e.target.value){ setSystemConfig({ marqueeText: e.target.value }); showToast('衛教跑馬燈已更新'); setShowMarqueeModal(false); } }} className="w-full p-4 rounded-xl border-2 border-sky-200 bg-sky-50 font-bold text-sky-800 outline-none">
                    <option value="">-- 選擇跑馬燈模版 --</option>
                    <option value="目前等候人數較多，請耐心等候，急診依檢傷分類非先到先看。">目前等候人數較多，請耐心等候</option>
                    <option value="流感好發季，請確實佩戴口罩，並落實勤洗手。">流感好發季，請確實佩戴口罩</option>
                    <option value="為保護病患隱私與感染控制，每床陪病家屬限一人。">每床陪病家屬限一人</option>
                 </select>
                 <div className="flex gap-2">
                    <input type="text" placeholder="自訂跑馬燈內容..." id="customMarquee" className="flex-1 border-2 border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-sky-400" />
                    <button onClick={() => { const v = document.getElementById('customMarquee').value; if(v) { setSystemConfig({ marqueeText: v }); showToast('衛教跑馬燈已更新'); setShowMarqueeModal(false); } }} className="bg-sky-600 text-white font-black px-6 rounded-xl whitespace-nowrap active:scale-95">更新</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showMultiBedModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-[3rem] p-10 shadow-2xl flex flex-col border border-white/20">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-2xl font-black text-indigo-600 flex items-center gap-3"><Icon name="👥" size={32}/> 大量病人呼叫 (壓力測試)</h3>
                 <button onClick={() => setShowMultiBedModal(false)} className="p-3 bg-slate-100 rounded-full active:scale-90 transition-transform"><Icon name="❌" size={16}/></button>
              </div>
              <div className="bg-indigo-50 border-2 border-indigo-200 p-8 rounded-[2rem] text-center mb-6">
                 <p className="text-indigo-800 font-bold mb-4">將模擬 12 張病床同時發出求助訊號，</p>
                 <p className="text-indigo-800 font-bold">以便測試行動護理機的任務佇列效能。</p>
              </div>
              <button onClick={() => { 
                const testBeds = PATIENTS_LIST.slice(0, 12);
                const tasks = ['toilet', 'iv', 'bleeding', 'other'];
                const msgs = ['🚽 前往洗手間', '💧 點滴快沒了', '🩹 點滴處滲血', '❓ 其他需求'];
                testBeds.forEach((p, i) => createAlert({patientId: p.id, type: tasks[i%4], message: msgs[i%4]}));
                showToast(`已成功模擬 12 床病患同時求助`); 
                setShowMultiBedModal(false); 
              }} className="w-full text-center p-6 rounded-[2rem] bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all text-xl shadow-xl active:scale-95">
                🚨 產生 12 筆模擬任務
              </button>
           </div>
        </div>
      )}
    </div>
  );
}

function AlertTaskCard({ alert, isStation, resolveAlert, showToast }) {
  const p = PATIENTS_LIST.find(x => x.id === alert.patientId);
  const [status, setStatus] = useState('pending'); 

  if (isStation) {
     return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-rose-500 animate-fade-in relative">
           <div className="flex justify-between items-start mb-2">
              <div><span className="font-black text-lg mr-2">BED {p?.bed}</span><span className="text-xs font-bold text-slate-500">{p?.name}</span></div>
           </div>
           <p className="font-black text-rose-600 mb-4">{alert.message}</p>
           <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-600 outline-none">
              <option value="">-- 取消 / 尚未分派 --</option>
              {STAFF_LIST.map(s => <option key={s.name} value={s.name}>指派給 {s.name}</option>)}
           </select>
        </div>
     );
  }

  return (
    <div className={`p-5 rounded-2xl shadow-sm border-l-4 transition-all animate-fade-in ${status==='pending'?'bg-white border-rose-500':'bg-sky-50 border-sky-500'}`}>
       <div className="flex justify-between items-start mb-2">
          <div><span className="font-black text-lg mr-2">BED {p?.bed}</span><span className="text-xs font-bold text-slate-500">{p?.name}</span></div>
          {status === 'pending' && <button onClick={()=>setStatus('processing')} className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full active:scale-95">🙋‍♀️ 由我處理</button>}
       </div>
       <p className={`font-black mb-4 ${status==='pending'?'text-rose-600':'text-sky-700'}`}>{alert.message}</p>
       
       {status === 'processing' && (
          <div className="space-y-2 animate-fade-in">
             <div className="flex gap-2">
                <button onClick={() => {
                   if (Math.random() < 0.2) {
                      window.alert(`【核對失敗】警告！掃描的病患腕帶與病歷號不符！請重新確認身分！`);
                   } else {
                      setStatus('verified'); showToast('身分核對正確 (3讀5對完成)');
                   }
                }} className="flex-1 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg border border-indigo-200 text-xs active:scale-95"><Icon name="📱" size={14}/> 掃描核對</button>
                <select onChange={(e)=>{ if(e.target.value){ showToast(`任務已交班給 ${e.target.value}`); resolveAlert(alert.id); } }} className="flex-1 py-2 bg-amber-50 text-amber-700 font-bold rounded-lg border border-amber-200 text-xs text-center outline-none">
                   <option value="">🔄 一鍵交班</option>
                   {STAFF_LIST.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
             </div>
             <SwipeToConfirm text="滑動以釋放任務" onConfirm={()=>setStatus('pending')} bgClass="bg-slate-200 border border-slate-300" textClass="text-slate-600" />
          </div>
       )}

       {status === 'verified' && (
          <div className="space-y-2 animate-fade-in">
             <div className="bg-emerald-100 text-emerald-700 text-xs font-black p-2 rounded-lg text-center mb-2 flex items-center justify-center gap-1"><Icon name="✅" size={14}/> 核對無誤</div>
             <button onClick={() => resolveAlert(alert.id)} className="w-full py-2.5 bg-emerald-500 text-white font-black rounded-xl shadow-md active:scale-95">完成任務並歸檔</button>
          </div>
       )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <div className="min-h-screen bg-rose-50 flex items-center justify-center p-12 text-center">
         <div className="bg-white p-12 rounded-[3rem] shadow-2xl border-4 border-rose-100">
            <h2 className="text-3xl font-black text-slate-800 mb-6">系統初始化異常</h2>
            <button onClick={() => window.location.reload()} className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black shadow-lg">強制重啟</button>
         </div>
      </div>
    );
    return this.props.children;
  }
}

export default function App() { return <ErrorBoundary><MainApp /></ErrorBoundary>; }
```eof

---

### ✅ 核心功能留存與修正檢查報告 (V62.8)

| 核心區塊 | 測試項目 | 狀態 | 備註 |
| :--- | :--- | :--- | :--- |
| **【跨裝置連線】** | Firebase 單一真值架構 (Single Source of Truth) | 🟢 修復 | 拔除舊版取值，患者狀態更新強制透過 `getPatientData` 作為基底寫入 Firebase，確保多裝置狀態同步。 |
| **【主控台操作】** | 開立檢驗、授權代簽、開放 SOS 切換 | 🟢 修復 | 修正狀態合併邏輯，所有按鈕點擊後能即時將新狀態傳送至 Firebase，雙端介面同步變更。 |
| **【離院操作】** | 30 分鐘倒數離院 / 滑動結案 / 撤銷 | 🟢 修復 | **補回批價倒數按鈕**；加入全域定時器監聽 `patientsState` 處理倒數；狀態變更同步至雲端。 |
| **【病患端操作】** | 發送「要幫忙」SOS 等求助任務 | 🟢 修復 | 修正 `createAlert` 參數傳遞，按下後任務順利寫入 Firebase `alerts` 陣列，護理端即時跳出警報。 |
| **【核心保留】** | 2.5D 高塔動態地圖導航與定位點 | 🟢 保留 | 介面無更動。 |
| **【核心保留】** | 行動護理機 3讀5對 與 任務交班 | 🟢 保留 | 介面無更動。 |
| **【核心保留】** | 大量病患呼叫模擬 (壓力測試) | 🟢 保留 | 介面無更動。 |
| **【核心保留】** | 廣播與跑馬燈自訂選單 | 🟢 保留 | 介面無更動。 |