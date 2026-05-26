// [V67 嚴禁下床與首頁視覺翻新版] 
// 1. 將「需臥床」全面更改為「嚴禁下床」。
// 2. 首頁更新：替換為「ER即時通, 醫點就通」圖形化 Logo 排版。
// 3. 嚴格保留所有核心連線、主控台邏輯與 V66 的功能。

import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, enableIndexedDbPersistence } from 'firebase/firestore';
import { Activity, AlertTriangle, ArrowUpCircle, Bell, Bone, CheckCircle2, ChevronDown, ChevronLeft, ChevronUp, CreditCard, Droplets, FileText, FlaskConical, HandHelping, KeyRound, Loader2, Lock, LogOut, Magnet, MapPin, Maximize, Mic, Monitor, MonitorSmartphone, Moon, PenTool, PhoneCall, Power, Search, Share2, ShieldAlert, Smartphone, Sun, UserCircle, Users, Waves, X, ZoomIn, ZoomOut, Volume2, VolumeX, Type, Clock, LogOut as LogOutIcon, CheckSquare, RefreshCw, ScanLine, UserCheck, AlertOctagon, Vibrate, VibrateOff, Navigation, ChevronRight, Trash2, Megaphone, Info } from 'lucide-react';

const myFirebaseConfig = {
  apiKey: "AIzaSyCtkjjg0bkfhua0ttmFw3sEQ0NJM4z7g48",
  authDomain: "er-omo.firebaseapp.com",
  projectId: "er-omo",
  storageBucket: "er-omo.firebasestorage.app",
  messagingSenderId: "402348034619",
  appId: "1:402348034619:web:d756aa4bdd7bbab92e2a1e",
};

const isSandbox = typeof __firebase_config !== 'undefined';
const configToUse = isSandbox ? JSON.parse(__firebase_config) : myFirebaseConfig;
const rawAppId = typeof __app_id !== 'undefined' ? String(__app_id) : 'default-app-id';
const safeAppId = rawAppId.includes('/') ? rawAppId.replace(/\//g, '_') : rawAppId;
const basePath = isSandbox ? `artifacts/${safeAppId}/public/data` : 'er_omo_system/data';

let app, auth, db;
let initError = null;

try {
  app = initializeApp(configToUse);
  auth = getAuth(app);
  db = getFirestore(app);
  enableIndexedDbPersistence(db).catch(() => {});
} catch (error) {
  initError = error.message;
}

// 動態生成 70 名測試病患資料，均勻分布於 4 大區域供壓力測試
const ZONES = ['重症區', '看診區', '兒科區', '留觀區'];
const LAST_NAMES = ['李', '林', '王', '陳', '張', '黃', '吳', '劉', '蔡', '楊'];
const FIRST_NAMES = ['大雄', '小花', '萬吉', '小明', '淑雅', '金智', '建國', '美麗', '家豪', '雅婷'];

const PATIENTS_LIST = Array.from({ length: 70 }, (_, i) => {
  const idNum = (i + 45).toString().padStart(3, '0');
  const bedNum = (i + 1).toString().padStart(2, '0');
  const lastName = LAST_NAMES[i % LAST_NAMES.length];
  const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
  const fullName = `${lastName}${firstName}`;
  const maskedName = `${lastName}Ｏ${firstName.charAt(1) || firstName.charAt(0)}`;
  const zone = ZONES[i % 4];
  const age = zone === '兒科區' ? (i % 14) + 1 : (i % 60) + 18;
  const triageLevel = (i % 5) + 1;

  return {
    id: `A${idNum}`,
    bed: bedNum,
    name: maskedName,
    fullName: fullName,
    dob: `19${90 - age}/01/01`,
    age: age,
    triageLevel: triageLevel,
    initialWaitingCount: i % 30,
    token: `tk_${i.toString(36)}${idNum}`,
    idLast4: '0000',
    zone: zone
  };
});

const STAFF_LIST = [
  { empId: 'A001', name: '李護理師', pwd: '0000' }, { empId: 'A002', name: '陳護理師', pwd: '0000' },
  { empId: 'A003', name: '林護理師', pwd: '0000' }, { empId: 'A004', name: '王護理師', pwd: '0000' }
];

const REMINDER_TYPES = [
  { id: 'no_water', icon: '💧', label: '禁喝水', desc: '檢查前請勿飲水' }, { id: 'no_food', icon: '🍔', label: '禁飲食', desc: '包含任何食物' },
  { id: 'stay_bed', icon: '🛏️', label: '嚴禁下床', desc: '請勿下床走動' }, { id: 'urine_test', icon: '🧪', label: '留尿液', desc: '請收集檢體' }
];

const DEFAULT_EXPLANATIONS = {
  '禁喝水': '阿公阿嬤，因為等一下要做檢查，怕喝水會影響結果，或是怕您嗆到。再忍耐一下下喔！',
  '禁飲食': '長輩您好，為了讓檢查結果準確，現在先不能吃東西也不能喝水喔。辛苦您了。',
  '嚴禁下床': '阿公阿嬤，為了您的安全，現在請乖乖躺在床上休息，千萬不要自己下床走動。',
  '留尿液': '長輩您好，醫生需要檢查您的尿液，請您去廁所的時候，幫忙留一點尿液。'
};

const FAQS = [
  { q: '床單、棉被可以到哪裡取？', a: '請至 掛號櫃檯 領取' },
  { q: '輪椅、陪病椅可以去哪裡借？', a: '請至 急診大門口 服務台借用' },
  { q: '飲食、尿布及清潔用品在哪裡可以購買？', a: '大廳有 超商 及 醫療用品店' },
  { q: '繳費後連結何時失效？', a: '批價完成後約 30 分鐘，系統將自動註銷連結以保障隱私。' }
];

const MAP_LAYOUT_1F = [
  [2, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 1, 2, 2, 2, 1, 4, 2, 2, 7, 2],
  [2, 6, 1, 2, 2, 2, 1, 4, 4, 2, 1, 2], 
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 1, 2, 2, 2, 1, 4, 4, 2, 1, 2],
  [2, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 5, 1, 2, 2, 2, 1, 6, 2, 5, 1, 2],
  [2, 1, 1, 1, 1, 7, 1, 1, 1, 1, 1, 2],
  [2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2],
];

const MAP_LAYOUT_3F = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2],
  [2, 6, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 8, 8, 2, 2, 2, 1, 2, 2, 2, 1, 2],
  [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const MAP_LANDMARKS = {
  'er_entrance': {row:9, col:7}, 'pharmacy': {row:0, col:1}, 'cashier': {row:0, col:2}, 
  'elevator': {row:3, col:1}, 'xray': {row:3, col:7}, 'ct': {row:3, col:8}, 
  'us': {row:5, col:7}, 'mri': {row:5, col:8}, 'blood': {row:6, col:1}, 
  'screening': {row:7, col:1}, 'ecg': {row:8, col:5}, 'nurse': {row:2, col:10}, 
  'icu': {row:5, col:2},
  'water': {row:2, col:7}, 'trash': {row:7, col:7}, 'toilet': {row:7, col:9}
};

const MED_STEPS = ['檢傷/掛號', '看診', '檢查/檢驗', '報告', '留觀/離院'];

const NAV_DESTINATIONS = [
  { id: 'er_entrance', icon: '🚪', label: '急診入口', guidance: '請往大門口方向走。' },
  { id: 'pharmacy', icon: '💊', label: '急診藥局', guidance: '請前往大廳，看到批價櫃檯後左轉，直接可以到藥局。' },
  { id: 'cashier', icon: '💳', label: '批價掛號', guidance: '請往大門口方向走，批價掛號櫃檯在您的右手邊。' },
  { id: 'elevator', icon: '🛗', label: '電梯', guidance: '請直走，經過批價櫃檯後，前方左側即是電梯。' },
  { id: 'xray', icon: '☢️', label: 'X光室', guidance: '請直走，經過批價櫃檯後，前方右側即是 X 光室。' },
  { id: 'ct', icon: '🖥️', label: '電腦斷層', guidance: '請直走，經過 X 光室後，最深處即是電腦斷層室。' },
  { id: 'us', icon: '🌊', label: '超音波室', guidance: '請往急救區方向走，超音波室在您的右側。' },
  { id: 'mri', icon: '🧲', label: '核磁共振', guidance: '請往深處走，經過超音波室後即可抵達核磁共振室。' },
  { id: 'blood', icon: '🔬', label: '檢驗科', guidance: '請直走，經過批價櫃檯後，前方左側即是檢驗科。' },
  { id: 'nurse', icon: '👩‍⚕️', label: '護理站', guidance: '請沿著中央走廊直走，護理站就在您的正前方。' },
  { id: 'icu', icon: '🏥', label: '加護病房', guidance: '請先搭乘電梯至 3 樓，出電梯後直走即可抵達加護病房。' },
  { id: 'toilet', icon: '🚻', label: '廁所', guidance: '請往大廳方向走，廁所在您的左手邊。' },
  { id: 'water', icon: '🚰', label: '飲水機', guidance: '請往大廳方向走，飲水機在您的右手邊。' },
  { id: 'trash', icon: '🗑️', label: '污物室', guidance: '請往大廳方向走，污物室在您的左手邊。' }
];

const CONSENT_TYPES = [
  { id: 'ct', label: '電腦斷層 (CT) 同意書', short: 'CT 同意書' }, 
  { id: 'admission', label: '住院同意書', short: '住院同意書' }
];

const LAB_TYPES = [
  { id: 'blood', label: '抽血', activeCls: 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400', iconBgCls: 'bg-rose-50/80 dark:bg-rose-500/20', color: 'rose', icon: Droplets },
  { id: 'urine', label: '尿液', activeCls: 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400', iconBgCls: 'bg-amber-50/80 dark:bg-amber-500/20', color: 'amber', icon: FlaskConical },
  { id: 'ecg', label: '心電圖', activeCls: 'bg-pink-50 border-pink-200 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400', iconBgCls: 'bg-pink-50/80 dark:bg-pink-500/20', color: 'pink', icon: Activity },
  { id: 'xray', label: 'X光', activeCls: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400', iconBgCls: 'bg-emerald-50/80 dark:bg-emerald-500/20', color: 'emerald', icon: Bone },
  { id: 'us', label: '超音波', activeCls: 'bg-cyan-50 border-cyan-200 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400', iconBgCls: 'bg-cyan-50/80 dark:bg-cyan-500/20', color: 'cyan', icon: Waves },
  { id: 'ct', label: 'CT', activeCls: 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400', iconBgCls: 'bg-purple-50/80 dark:bg-purple-500/20', color: 'purple', icon: Monitor },
  { id: 'mri', label: 'MRI', activeCls: 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400', iconBgCls: 'bg-indigo-50/80 dark:bg-indigo-500/20', color: 'indigo', icon: Magnet },
  { id: 'other', label: '其他', activeCls: 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-slate-300', iconBgCls: 'bg-slate-100/80 dark:bg-slate-700/50', color: 'slate', icon: FileText }
];

const TRIAGE_STYLES = {
  1: { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/30', dot: 'bg-red-500', name: '1級 (復甦急救)', msg: '醫療團隊正全力處置中。', lineColor: '#ef4444' },
  2: { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/30', dot: 'bg-orange-500', name: '2級 (危急)', msg: '護理人員將盡快安排處置，請稍候。', lineColor: '#f97316' },
  3: { color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10', border: 'border-yellow-200 dark:border-yellow-500/30', dot: 'bg-yellow-500', name: '3級 (緊急)', msg: '正為您安排檢查。等候人數可能變動。', lineColor: '#eab308' },
  4: { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30', dot: 'bg-green-500', name: '4級 (次緊急)', msg: '急診以重症優先，等待時間較長。', lineColor: '#22c55e' },
  5: { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', dot: 'bg-blue-500', name: '5級 (非緊急)', msg: '急診以重症為優先，感謝您的耐心配合。', lineColor: '#3b82f6' }
};

const getTriageStyle = (level) => TRIAGE_STYLES[level] || { color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10', border: 'border-sky-200 dark:border-sky-500/30', dot: 'bg-sky-500', name: '未分類', msg: '請等候護理人員指示。', lineColor: '#0ea5e9' };

const getMergedState = (fetchedState, patientId) => {
  const patient = PATIENTS_LIST.find(p => p.id === patientId);
  const baseState = {
    currentStep: 1, waitingCount: patient ? patient.initialWaitingCount : 12, currentStatus: '等候醫師看診/開單',
    reminders: [], sosEnabled: false, consents: { ct: 'disabled', admission: 'disabled' }, location: '急診大廳', rfid: 'active', tokenExpired: false, billingPaidAt: null,
    labStatus: { 
      blood: { status: 'unprescribed', text: '未開立', eta: '-' }, urine: { status: 'unprescribed', text: '未開立', eta: '-' }, 
      ecg: { status: 'unprescribed', text: '未開立', eta: '-' }, xray: { status: 'unprescribed', text: '未開立', eta: '-' }, 
      us: { status: 'unprescribed', text: '未開立', eta: '-' }, ct: { status: 'unprescribed', text: '未開立', eta: '-' }, 
      mri: { status: 'unprescribed', text: '未開立', eta: '-' }, other: { status: 'unprescribed', text: '未開立', eta: '-' }
    }
  };
  if (!fetchedState) return baseState;
  return { 
    ...baseState, ...fetchedState, 
    labStatus: { ...baseState.labStatus, ...(fetchedState.labStatus || {}) }, 
    consents: { ...baseState.consents, ...(fetchedState.consents || {}) }, 
    reminders: fetchedState.reminders || [] 
  };
};

const SwipeToConfirm = ({ onConfirm, text, bgClass = "bg-slate-100 dark:bg-slate-700", textClass = "text-slate-500 dark:text-slate-400", activeBgClass = "bg-emerald-500", activeTextClass = "text-white", icon = <ChevronRight className="w-5 h-5 text-slate-400"/> }) => {
  const [dragX, setDragX] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const containerRef = useRef(null);

  const handleMove = (clientX) => {
    if (unlocked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const thumbWidth = 48;
    let newX = clientX - rect.left - (thumbWidth / 2);
    newX = Math.max(0, Math.min(newX, rect.width - thumbWidth));
    setDragX(newX);
    
    if (newX >= rect.width - thumbWidth - 10) {
      setUnlocked(true);
      setDragX(rect.width - thumbWidth);
      if(navigator.vibrate) navigator.vibrate([50]);
      setTimeout(() => onConfirm(), 300);
    }
  };

  const handleTouchMove = (e) => handleMove(e.touches[0].clientX);
  const handleMouseMove = (e) => { if (e.buttons === 1) handleMove(e.clientX); };
  const handleEnd = () => { if (!unlocked) setDragX(0); };

  return (
    <div ref={containerRef} className={`relative w-full h-12 rounded-[1.5rem] flex items-center justify-center overflow-hidden touch-none select-none transition-colors duration-300 shadow-inner ${unlocked ? activeBgClass : bgClass}`} 
         onTouchMove={handleTouchMove} onTouchEnd={handleEnd} onMouseMove={handleMouseMove} onMouseUp={handleEnd} onMouseLeave={handleEnd}>
      <span className={`text-sm font-bold z-0 transition-opacity ${unlocked ? activeTextClass : textClass}`}>{unlocked ? '✅ 已授權確認' : text}</span>
      <div className={`absolute left-1 top-1 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md z-10 transition-transform ${unlocked ? 'opacity-0' : ''}`} 
           style={{ transform: `translateX(${dragX}px)`, transition: isNaN(dragX) || dragX === 0 ? 'transform 0.3s ease' : 'none' }}>
         {icon}
      </div>
    </div>
  );
};

const HeaderSettings = ({ settings, toggleSetting, onLogout }) => (
  <div className="flex items-center gap-1.5 sm:gap-2">
    <button onClick={() => toggleSetting('voice')} className={`p-1.5 sm:p-2 rounded-full transition-all ${settings.voice ? 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`} title="語音提醒">
      {settings.voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
    <button onClick={() => toggleSetting('vibe')} className={`p-1.5 sm:p-2 rounded-full transition-all ${settings.vibe ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`} title="震動提醒">
      {settings.vibe ? <Vibrate size={18} /> : <VibrateOff size={18} />}
    </button>
    <button onClick={() => toggleSetting('elderMode')} className={`p-1.5 sm:p-2 rounded-full transition-all flex items-center gap-1 ${settings.elderMode ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 bg-slate-100 dark:bg-slate-800'}`} title="長者大字模式">
      <Type size={16} /><span className="text-xs font-bold hidden sm:inline">{settings.elderMode ? '長者' : '標準'}</span>
    </button>
    <button onClick={() => toggleSetting('isDarkMode')} className="p-1.5 sm:p-2 rounded-full text-slate-500 bg-slate-100 dark:bg-slate-800">
      {settings.isDarkMode ? <Sun size={18} className="text-amber-500"/> : <Moon size={18} className="text-indigo-500"/>}
    </button>
    {onLogout && (
      <button onClick={onLogout} className="p-1.5 sm:p-2 bg-rose-50 dark:bg-rose-500/20 rounded-full text-rose-500 ml-1">
        <LogOutIcon size={18}/>
      </button>
    )}
  </div>
);

function PatientVerify({ role, setRole, selectedPatient, setSelectedPatient, settings, toggleSetting }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  if (!selectedPatient) return null;
  
  const handleVerify = () => { 
    if (pin === selectedPatient.idLast4) { 
       if (role === 'proxy_verify') setRole('proxy_app');
       else if (role === 'family_verify') setRole('family_app');
       else setRole('patient_app');
    } else { 
       setError(true); setPin(''); 
    } 
  };

  const isProxy = role === 'proxy_verify';

  return (
     <div className="flex flex-col items-center justify-center p-6 min-h-screen relative flex-1 animate-[fadeIn_0.3s_ease-out] bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900">
        <div className="absolute top-6 left-6 right-6 flex justify-between z-20">
           {!isProxy && <button onClick={() => {setRole(role === 'family_verify' ? 'family_select' : 'patient_select'); setSelectedPatient(null);}} className="text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/50"><ChevronLeft className="w-5 h-5"/> 返回</button>}
           <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
        </div>
        <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] w-full max-w-sm flex flex-col items-center text-center border border-white/50 dark:border-slate-700/50 z-10">
           <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${isProxy ? 'bg-purple-100/80 text-purple-600' : 'bg-sky-100/80 text-sky-500'}`}>
             {isProxy ? <PenTool className="w-10 h-10"/> : <Lock className="w-10 h-10" />}
           </div>
           <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-widest">{isProxy ? '代理人授權驗證' : '身分驗證'}</h2>
           <p className="text-base text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">請輸入病患 <b className={`text-xl ${isProxy ? 'text-purple-600' : 'text-sky-600'}`}>{selectedPatient.name}</b> 的身分證後四碼。<br/><span className="text-sm text-slate-400 mt-2 block">(測試預設: 0000)</span></p>
           <div className="w-full mb-6">
              <div className={`flex items-center bg-white/80 dark:bg-slate-900/80 rounded-xl border-2 px-4 py-3 transition-colors ${error ? 'border-rose-500' : 'border-slate-200 dark:border-slate-600 focus-within:border-sky-500'}`}>
                 <KeyRound className={`w-6 h-6 mr-3 ${error ? 'text-rose-500' : 'text-slate-400'}`} />
                 <input type="password" maxLength="4" placeholder="輸入四碼數字" className="bg-transparent w-full outline-none text-2xl tracking-[0.5em] font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:tracking-normal" value={pin} onChange={(e) => {setPin(e.target.value.replace(/[^0-9]/g, '')); setError(false);}} onKeyDown={(e) => e.key === 'Enter' && handleVerify()} />
              </div>
              {error && <p className="text-rose-500 text-sm font-bold mt-2 animate-bounce">驗證碼錯誤，請重新輸入</p>}
           </div>
           <button onClick={handleVerify} disabled={pin.length !== 4} className={`w-full font-bold py-4 rounded-xl text-xl transition-all shadow-lg active:scale-95 ${pin.length === 4 ? (isProxy ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'bg-sky-500 hover:bg-sky-600 text-white') : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400 cursor-not-allowed'}`}>
              {isProxy ? '解鎖代簽權限' : '解鎖進入'}
           </button>
        </div>
     </div>
  );
}

function StaffLogin({ role, setRole, setSelectedNurse, settings, toggleSetting }) {
  const isStation = role === 'station_login';
  const [empId, setEmpId] = useState('');
  const [pwd, setPwd] = useState(''); 
  const [error, setError] = useState('');

  const handlePwdLogin = () => {
     if (isStation) { 
         setRole('station'); setSelectedNurse('主控台管理員');
     } 
     else { 
         const nurseName = empId ? `${empId}護理師` : '測試護理師';
         setSelectedNurse(nurseName); setRole('nurse_mobile');
     }
  };

  return (
     <div className="flex flex-col items-center justify-center p-6 min-h-screen relative flex-1 animate-[fadeIn_0.3s_ease-out] bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-slate-900 dark:to-slate-800">
        <div className="absolute top-6 left-6 right-6 flex justify-between z-20">
           <button onClick={() => setRole(null)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/50"><ChevronLeft className="w-6 h-6"/> 返回首頁</button>
           <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
        </div>
        <div className="w-24 h-24 bg-indigo-500 dark:bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-[0_10px_20px_rgba(99,102,241,0.3)] z-10">{isStation ? <Monitor className="w-12 h-12"/> : <Smartphone className="w-12 h-12"/>}</div>
        <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-widest z-10">{isStation ? '主控台登入' : '護理師端登入'}</h2>
        <p className="text-indigo-500 dark:text-indigo-400 font-bold mb-8 text-base z-10">請輸入員工編號與密碼 (可隨意測試輸入)</p>
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 z-10">
           <div className="p-8">
              <div className="space-y-4 animate-[fadeIn_0.2s_ease-out]">
                 <div><label className="block text-sm font-bold text-slate-500 mb-1.5">員工編號 (ID)</label><input type="text" value={empId} onChange={e => {setEmpId(e.target.value); setError('');}} placeholder="請輸入編號" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 text-slate-900 dark:text-white uppercase font-bold text-lg" /></div>
                 <div><label className="block text-sm font-bold text-slate-500 mb-1.5">登入密碼</label><input type="password" value={pwd} onChange={e => {setPwd(e.target.value); setError('');}} placeholder="請輸入密碼" onKeyDown={(e) => e.key === 'Enter' && handlePwdLogin()} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 outline-none focus:border-indigo-500 text-slate-900 dark:text-white font-bold text-lg" /></div>
                 {error && <p className="text-rose-500 text-sm font-bold mt-1 text-center">{error}</p>}
                 <button onClick={handlePwdLogin} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-xl shadow-md active:scale-95 mt-2 transition-transform text-lg">登入系統</button>
              </div>
           </div>
        </div>
     </div>
  );
}

function MainApp() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); 
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const [settings, setSettings] = useState({
    voice: true, vibe: true, elderMode: false, isDarkMode: false
  });
  
  const [systemConfig, setSystemConfig] = useState({ 
    marqueeText: '【急診衛教宣導】為防範呼吸道傳染病，進入醫療院所請全程配戴口罩。若有發燒或咳嗽症狀，請立即告知護理人員，感謝您的配合。' 
  });

  const toggleSetting = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const [alerts, setAlerts] = useState([]);
  const [commands, setCommands] = useState([]);
  const [patientsState, setPatientsState] = useState({});
  const syncChannelRef = useRef(null);

  useEffect(() => {
    if (settings.isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.isDarkMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || window.location.hash.replace('#token=', '');
    const isProxy = params.get('proxy') === 'true';

    if (tokenParam) {
      const target = PATIENTS_LIST.find(p => p.token === tokenParam);
      if (target) { 
         setSelectedPatient(target); 
         setRole(isProxy ? 'proxy_verify' : 'family_verify'); 
         return; 
      }
    }

    const viewParam = params.get('view');
    if (viewParam === 'patient') setRole('patient_select');
    else if (viewParam === 'family') setRole('family_select');
    else if (viewParam === 'station') setRole('station_login');
    else if (viewParam === 'nurse') setRole('nurse_login');
  }, []);

  useEffect(() => {
    if (initError) return;
    let isMounted = true;
    const setupAuth = async () => {
      try {
        if (isSandbox && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.warn("登入警告:", err.message);
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };
    setupAuth();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!isAuthReady || initError) return;
    const unsub = onAuthStateChanged(auth, (u) => {
       setUser(u || { uid: `guest_${Math.random().toString(36).substr(2, 9)}` });
    });
    return () => unsub();
  }, [isAuthReady]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      Object.entries(patientsState).forEach(([id, st]) => {
        if (st.billingPaidAt && !st.tokenExpired) {
          if (now - st.billingPaidAt >= 30 * 60 * 1000) {
            updatePatientState(id, { tokenExpired: true, currentStep: 4, currentStatus: '已自動離院結案' });
          }
        }
      });
    }, 10000); 
    return () => clearInterval(timer);
  }, [patientsState]);

  useEffect(() => {
    if (!user || initError) return;
    
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
        syncChannelRef.current = new BroadcastChannel('omo_sync_channel');
        syncChannelRef.current.onmessage = (e) => {
            if (e.data.type === 'SYNC_ALERTS') setAlerts(e.data.payload);
            if (e.data.type === 'SYNC_COMMANDS') setCommands(e.data.payload);
            if (e.data.type === 'SYNC_PATIENTS') setPatientsState(e.data.payload);
            if (e.data.type === 'SYNC_SYSTEM') setSystemConfig(e.data.payload);
        };
    }

    const handleStorageChange = (e) => {
         if (e.key === 'omo_patients') setPatientsState(JSON.parse(e.newValue || '{}'));
         if (e.key === 'omo_alerts') setAlerts(JSON.parse(e.newValue || '[]'));
         if (e.key === 'omo_commands') setCommands(JSON.parse(e.newValue || '[]'));
         if (e.key === 'omo_system') setSystemConfig(JSON.parse(e.newValue || '{}'));
    };
    window.addEventListener('storage', handleStorageChange);

    let unsubAlerts = () => {}, unsubCmds = () => {}, unsubPatients = () => {}, unsubSystem = () => {};
    const handleDbError = (err) => { console.warn("Firebase 同步暫停，已切換為本地備援模式"); };

    try {
        unsubAlerts = onSnapshot(collection(db, basePath, 'alerts'), (snap) => { 
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() })); 
          data.sort((a, b) => b.timestamp - a.timestamp); 
          setAlerts(data); 
        }, handleDbError);
        
        unsubCmds = onSnapshot(collection(db, basePath, 'commands'), (snap) => { 
          setCommands(snap.docs.map(d => ({ id: d.id, ...d.data() }))); 
        }, handleDbError);
        
        unsubPatients = onSnapshot(collection(db, basePath, 'patients'), (snap) => { 
          const pData = {}; snap.docs.forEach(doc => { pData[doc.id] = doc.data(); }); 
          setPatientsState(pData); 
        }, handleDbError);
        
        unsubSystem = onSnapshot(doc(db, basePath, 'system', 'config'), (doc) => {
          if(doc.exists()) setSystemConfig(doc.data());
        }, handleDbError);

    } catch(err) {
        console.warn("Firestore Listen Error:", err);
    }

    return () => { 
        unsubAlerts(); unsubCmds(); unsubPatients(); unsubSystem();
        window.removeEventListener('storage', handleStorageChange);
        if (syncChannelRef.current) syncChannelRef.current.close(); 
    };
  }, [user]);

  const broadcastSync = (type, key, data) => {
      localStorage.setItem(key, JSON.stringify(data));
      if (syncChannelRef.current) syncChannelRef.current.postMessage({ type, payload: data });
  };

  const createAlert = async (data) => { 
      const newId = Math.random().toString(36).substr(2, 9);
      const newObj = { ...data, timestamp: Date.now(), status: 'pending', assignedTo: null };
      setAlerts(prev => { const next = [{ id: newId, ...newObj }, ...prev]; broadcastSync('SYNC_ALERTS', 'omo_alerts', next); return next; });
      if (user && db) { try { await setDoc(doc(db, basePath, 'alerts', newId), newObj); } catch(e){} }
  };
  const updateAlert = async (id, data) => { 
      setAlerts(prev => { const next = prev.map(a => a.id === id ? { ...a, ...data } : a); broadcastSync('SYNC_ALERTS', 'omo_alerts', next); return next; });
      if (user && db) { try { await setDoc(doc(db, basePath, 'alerts', id), data, { merge: true }); } catch(e){} }
  };
  const resolveAlert = async (id) => { 
      setAlerts(prev => { const next = prev.filter(a => a.id !== id); broadcastSync('SYNC_ALERTS', 'omo_alerts', next); return next; });
      if (user && db) { try { await deleteDoc(doc(db, basePath, 'alerts', id)); } catch(e){} }
  };
  const clearAllAlerts = async () => {
      const currentAlerts = [...alerts];
      setAlerts([]);
      broadcastSync('SYNC_ALERTS', 'omo_alerts', []);
      if (user && db) {
          currentAlerts.forEach(async (a) => {
              try { await deleteDoc(doc(db, basePath, 'alerts', a.id)); } catch(e){}
          });
      }
  };
  const createCommand = async (data) => { 
      const newId = Math.random().toString(36).substr(2, 9);
      const newObj = { ...data, timestamp: Date.now() };
      setCommands(prev => { const next = [{ id: newId, ...newObj }, ...prev]; broadcastSync('SYNC_COMMANDS', 'omo_commands', next); return next; });
      if (user && db) { try { await setDoc(doc(db, basePath, 'commands', newId), newObj); } catch(e){} }
  };
  const ackCommand = async (id) => { 
      setCommands(prev => { const next = prev.filter(c => c.id !== id); broadcastSync('SYNC_COMMANDS', 'omo_commands', next); return next; });
      if (user && db) { try { await deleteDoc(doc(db, basePath, 'commands', id)); } catch(e){} }
  };
  const updatePatientState = async (id, data) => { 
      setPatientsState(prev => { const next = { ...prev, [id]: { ...(prev[id] || {}), ...data } }; broadcastSync('SYNC_PATIENTS', 'omo_patients', next); return next; });
      if (user && db) { try { await setDoc(doc(db, basePath, 'patients', id), data, { merge: true }); } catch(e){} }
  };
  const updateSystemConfig = async (data) => {
      const next = { ...systemConfig, ...data };
      setSystemConfig(next);
      broadcastSync('SYNC_SYSTEM', 'omo_system', next);
      if (user && db) { try { await setDoc(doc(db, basePath, 'system', 'config'), next, { merge: true }); } catch(e){} }
  };

  if (initError) {
      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border-2 border-rose-100">
             <AlertTriangle className="w-24 h-24 text-rose-500 mx-auto mb-6 animate-pulse" />
             <h1 className="text-3xl font-black text-slate-800 mb-4">系統安全防護已啟動</h1>
             <p className="text-rose-600 font-bold mb-4 bg-rose-50 p-4 rounded-lg break-words text-lg">{initError}</p>
          </div>
        </div>
      );
  }

  // 設定全域基礎字體大小放大 (透過 className text-lg)
  // 長者模式時進一步放大 (透過自訂 elder-mode class)
  const globalClass = `text-lg font-sans ${settings.isDarkMode ? 'dark' : ''} ${settings.elderMode ? 'elder-mode' : ''}`;

  return (
    <div className={globalClass}>
      <style>{`
        /* 長者模式進一步放大所有文字 */
        .elder-mode { font-size: 130%; }
        .elder-mode h1 { font-size: 2.5rem; }
        .elder-mode h2 { font-size: 2rem; }
        .elder-mode button { transform: scale(1.02); }

        /* 護理站主控台長者模式放大 */
        .elder-mode .console-patient-card h3 { font-size: 1.8rem; line-height: 2.2rem; }
        .elder-mode .console-patient-card .text-xs { font-size: 1rem; line-height: 1.5rem; padding: 0.3rem 0.5rem; }
        .elder-mode .console-patient-card .text-sm { font-size: 1.15rem; line-height: 1.75rem; }
        .elder-mode .console-patient-card .text-2xl { font-size: 2rem; line-height: 2rem; width: 4.5rem; height: 4.5rem; }
        .elder-mode .console-patient-card button { font-size: 1.05rem; padding-top: 0.6rem; padding-bottom: 0.6rem; }
        
        /* 緊急廣播半幅下滑動畫 */
        @keyframes slideDownHalf {
           from { transform: translateY(-100%); opacity: 0; }
           to { transform: translateY(0); opacity: 1; }
        }

        /* 導航箭頭閃爍放大動畫 */
        @keyframes arrowFlash {
           0% { opacity: 0; transform: scale(0.8) translateY(4px); filter: drop-shadow(0 0 2px rgba(14,165,233,0.3)); }
           30% { opacity: 1; transform: scale(1.3) translateY(0); filter: drop-shadow(0 0 10px rgba(14,165,233,0.8)); }
           70% { opacity: 0.5; transform: scale(1) translateY(0); filter: drop-shadow(0 0 5px rgba(14,165,233,0.5)); }
           100% { opacity: 0; transform: scale(0.8) translateY(0); filter: drop-shadow(0 0 0px transparent); }
        }
        .arrow-step {
           animation: arrowFlash 1.5s infinite;
           opacity: 0;
           will-change: transform, opacity, filter;
        }

        @keyframes marquee {
           0% { transform: translateX(100%); }
           100% { transform: translateX(-100%); }
        }
        .animate-marquee {
           display: inline-block;
           white-space: nowrap;
           animation: marquee 20s linear infinite;
        }
        
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-900 transition-colors duration-500 font-sans text-slate-800 dark:text-slate-200 flex flex-col">
        {!role && (
          <div className="flex flex-col items-center justify-center p-6 min-h-screen relative flex-1 animate-[fadeIn_0.3s_ease-out]">
            <div className="absolute top-6 right-6 z-20">
               <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
            </div>
            
            {/* 首頁 Logo 區塊 - 精美重製版 */}
            <div className="mb-6 w-full max-w-[320px] sm:max-w-[450px] flex flex-col items-center justify-center">
                {/* 實際運作時，若根目錄有 logo.png，則會顯示真實圖片 */}
                <img 
                    src="logo.png" 
                    alt="ER即時通, 醫點就通" 
                    className="w-full h-auto object-contain drop-shadow-sm mb-4"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                        }
                    }}
                />
                {/* 預覽環境若無圖檔，自動啟用的精緻 CSS 備用 Logo */}
                <div className="flex-col items-center text-center animate-[fadeIn_0.5s_ease-out] mb-4" style={{ display: 'none' }}>
                    <div className="flex items-center justify-center relative scale-90 sm:scale-100">
                        <span className="text-[6rem] sm:text-[7rem] font-black text-[#5ba1f8] leading-none tracking-tighter drop-shadow-md z-10">E</span>
                        <div className="relative flex items-center justify-center z-20 -ml-2">
                           <span className="text-[6rem] sm:text-[7rem] font-black text-[#4ad2c4] leading-none tracking-tighter drop-shadow-md">R</span>
                           <span className="absolute text-white text-4xl sm:text-5xl font-black drop-shadow-sm mt-1 ml-1">+</span>
                        </div>
                        <div className="ml-1 mt-4 text-[#f37c8b] flex flex-col items-center z-0 animate-pulse">
                           <span className="text-4xl sm:text-5xl">❤️</span>
                        </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#3b82f6] to-[#0d9488] tracking-widest mt-2 drop-shadow-sm px-4">ER即時通, 醫點就通</h1>
                </div>
            </div>

            <p className="text-teal-600 dark:text-teal-400 font-bold mb-8 text-center text-sm bg-teal-50 dark:bg-teal-500/10 px-5 py-2 rounded-full border border-teal-200 dark:border-teal-500/30 shadow-sm">版本訊息 V67</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-8 text-center max-w-lg">若要測試網址獨立分流，請在網址後方加上參數：<br/><span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sky-600 mt-2 inline-block shadow-inner">?view=patient</span> 或 <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-sky-600 shadow-inner">?view=station</span></p>
            
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center shadow-xl hover:border-sky-500 transition-colors">
                <Smartphone className="w-20 h-20 text-sky-500 dark:text-sky-400 mb-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">一般使用者端</h2>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-base">提供給病患本人或家屬使用，兩者在首頁將有不同的導航起點與隱私呈現。</p>
                <div className="w-full space-y-3">
                  <button onClick={() => setRole('patient_select')} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-5 rounded-xl text-xl shadow-md transition-colors">🏥 病患本人登入</button>
                  <button onClick={() => setRole('family_select')} className="w-full bg-amber-50 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/50 text-amber-600 dark:text-amber-500 font-bold py-4 rounded-xl shadow-sm hover:bg-amber-100 transition-colors text-lg">👨‍👩‍👧 家屬探視登入</button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 sm:p-8 flex flex-col items-center shadow-xl hover:border-indigo-500 transition-colors">
                <Monitor className="w-20 h-20 text-indigo-500 dark:text-indigo-400 mb-6" />
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">醫療護理端</h2>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-base">掌握全區病患動態，可授權求救按鈕並派單給行動護理師處理。</p>
                <div className="w-full space-y-3">
                  <button onClick={() => setRole('station_login')} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-5 rounded-xl shadow-md transition-colors text-xl">💻 護理站主控台</button>
                  <button onClick={() => setRole('nurse_login')} className="w-full bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300 font-bold py-4 rounded-xl hover:bg-indigo-100 transition-colors text-lg">📱 護理師公務機</button>
                </div>
              </div>

            </div>
          </div>
        )}

        {(role === 'station_login' || role === 'nurse_login') && <StaffLogin role={role} setRole={setRole} setSelectedNurse={setSelectedNurse} settings={settings} toggleSetting={toggleSetting} />}
        {(role === 'patient_verify' || role === 'family_verify' || role === 'proxy_verify') && <PatientVerify role={role} setRole={setRole} selectedPatient={selectedPatient} setSelectedPatient={setSelectedPatient} settings={settings} toggleSetting={toggleSetting} />}

        {role === 'patient_select' && (
          <div className="flex flex-col items-center justify-center p-6 min-h-screen animate-[fadeIn_0.3s_ease-out] relative flex-1 bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900">
            <div className="absolute top-6 left-6 right-6 flex justify-between z-20">
               <button onClick={() => {setRole(null); try{window.history.replaceState({}, '', window.location.pathname);}catch(e){}}} className="text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/50"><ChevronLeft className="w-6 h-6"/> 返回</button>
               <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-widest text-center mt-12 z-10">請選擇您的身分</h2>
            <p className="text-sky-600 dark:text-sky-400 font-bold mb-10 text-center text-base z-10 bg-white/50 dark:bg-slate-800/50 px-5 py-2 rounded-full backdrop-blur-md">為保護隱私，選定後需進行驗證</p>
            <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-3 gap-6 z-10">
              {PATIENTS_LIST.map(p => (
                <button key={p.id} onClick={() => { setSelectedPatient(p); setRole('patient_verify'); }} className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-white/50 dark:border-slate-700 p-8 rounded-[2rem] flex flex-col items-center hover:scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all group hover:border-sky-400 hover:shadow-[0_4px_20px_rgba(56,189,248,0.3)]`}>
                  <div className={`w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center font-black text-3xl text-slate-700 dark:text-white mb-4 border border-slate-100 dark:border-slate-700 shadow-inner transition-colors group-hover:text-sky-600 group-hover:bg-sky-50`}>{p.bed}</div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">{p.name}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-2">{p.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {role === 'family_select' && (
          <div className="flex flex-col items-center justify-center p-6 min-h-screen animate-[fadeIn_0.3s_ease-out] relative flex-1 bg-gradient-to-br from-sky-50 via-slate-50 to-amber-50 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900">
            <div className="absolute top-6 left-6 right-6 flex justify-between z-20">
               <button onClick={() => {setRole(null); try{window.history.replaceState({}, '', window.location.pathname);}catch(e){}}} className="text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-md shadow-sm border border-slate-200/50 dark:border-slate-700/50"><ChevronLeft className="w-6 h-6"/> 返回</button>
               <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-widest text-center mt-12 z-10">請選擇探視病患</h2>
            <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-3 gap-6 z-10">
              {PATIENTS_LIST.map(p => (
                <button key={p.id} onClick={() => { setSelectedPatient(p); setRole('family_verify'); }} className={`bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-white/50 dark:border-slate-700 p-8 rounded-[2rem] flex flex-col items-center hover:scale-105 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all group hover:border-amber-400 hover:shadow-[0_4px_20px_rgba(251,191,36,0.3)]`}>
                  <div className={`w-20 h-20 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center font-black text-3xl text-slate-700 dark:text-white mb-4 border border-slate-100 dark:border-slate-700 shadow-inner transition-colors group-hover:text-amber-600 group-hover:bg-amber-50`}>{p.bed}</div>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">{p.name}</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-2">{p.id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {((role === 'patient_app' || role === 'family_app' || role === 'proxy_app') && selectedPatient) && (
          <PatientFamilyApp 
            mode={role.replace('_app', '')} currentPatient={selectedPatient} patientState={getMergedState(patientsState[selectedPatient.id], selectedPatient.id)} 
            systemConfig={systemConfig}
            updatePatientState={updatePatientState} alerts={alerts} createAlert={createAlert} resolveAlert={resolveAlert} commands={commands} ackCommand={ackCommand} 
            settings={settings} toggleSetting={toggleSetting}
            onLogout={() => { setRole(null); setSelectedPatient(null); try { window.history.replaceState({}, '', window.location.pathname); } catch(e){} }}
          />
        )}

        {(role === 'station' || role === 'nurse_mobile') && (
          <NurseApp 
            role={role} nurseName={role === 'station' ? '主控台' : selectedNurse} alerts={alerts} updateAlert={updateAlert} resolveAlert={resolveAlert} createAlert={createAlert} clearAllAlerts={clearAllAlerts}
            patientsState={patientsState} updatePatientState={updatePatientState} createCommand={createCommand} PATIENTS_LIST={PATIENTS_LIST}
            systemConfig={systemConfig} updateSystemConfig={updateSystemConfig}
            settings={settings} toggleSetting={toggleSetting}
            onLogout={() => { setRole(null); setSelectedNurse(null); try { window.history.replaceState({}, '', window.location.pathname); } catch(e){} }}
          />
        )}
      </div>
    </div>
  );
}

function PatientFamilyApp({ mode, currentPatient, patientState, systemConfig, updatePatientState, alerts, createAlert, resolveAlert, commands, ackCommand, onLogout, settings, toggleSetting }) {
  if (patientState.tokenExpired) {
    return (
      <div className="flex flex-col items-center justify-center p-10 min-h-screen text-center animate-[fadeIn_0.5s_ease-out] bg-slate-50 dark:bg-slate-900">
         <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
            <Lock className="w-24 h-24 text-slate-300 mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-4">就診紀錄已結案</h2>
            <p className="text-slate-500 mb-10 font-bold text-lg">為保護您的隱私，當病患離院或繳費超時，此專屬連結即自動註銷失效。</p>
            <button onClick={onLogout} className="w-full bg-sky-500 text-white font-bold py-5 rounded-2xl shadow-md active:scale-95 text-xl">返回系統首頁</button>
         </div>
      </div>
    );
  }

  const isPatientMode = mode === 'patient';
  const isFamilyMode = mode === 'family';
  const isProxyMode = mode === 'proxy'; 

  const [activeTab, setActiveTab] = useState('progress'); 
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [recallInfo, setRecallInfo] = useState(null); 
  const [showUrgentCall, setShowUrgentCall] = useState(false);
  const [showTriageBumpAlert, setShowTriageBumpAlert] = useState(false); 
  const [customEmergencyAlert, setCustomEmergencyAlert] = useState(null);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeConsentModal, setActiveConsentModal] = useState(null);
  const [activeDestination, setActiveDestination] = useState(null);
  const [navigationState, setNavigationState] = useState('idle'); 
  const [currentFloor, setCurrentFloor] = useState('1F');
  const [calculatedPath, setCalculatedPath] = useState([]);
  
  const mapRef = useRef(null);
  const transformRef = useRef({ x: 0, y: 0, scale: 0.6 });
  const startDragPos = useRef({ x: 0, y: 0, initialScale: 1, initialPinchDist: 0, isDragging: false });
  const reqFrameRef = useRef(null);

  const [openFaqIndex, setOpenFaqIndex] = useState(null); 
  const [hasNotifiedBilling, setHasNotifiedBilling] = useState(false);
  const processedCmdsRef = useRef(new Set()); 

  const { currentStep, currentStatus, waitingCount, labStatus, reminders, rfid, sosEnabled, consents, billingPaidAt } = patientState;
  
  const currentUrl = typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0] : 'https://er-omo.demo';
  const shareUrl = `${currentUrl}?token=${currentPatient.token}`;

  const playVoice = (text, overrideSilent = false) => { 
      if ('speechSynthesis' in window && isAudioUnlocked && (settings.voice || overrideSilent)) { 
          window.speechSynthesis.cancel(); 
          const u = new SpeechSynthesisUtterance(text); 
          u.lang = 'zh-TW'; 
          u.rate = settings.elderMode ? 0.8 : 0.9; 
          window.speechSynthesis.speak(u); 
      } 
  };

  const triggerVibe = (pattern, overrideSilent = false) => {
      if ((settings.vibe || overrideSilent) && navigator.vibrate) navigator.vibrate(pattern);
  }

  useEffect(() => {
      if (billingPaidAt && !hasNotifiedBilling) {
          triggerVibe([500, 200, 500, 200, 500]);
          playVoice("您已完成批價繳費手續。為保障隱私，系統將於三十分鐘後自動登出，請盡速前往藥局領藥，辛苦了！");
          setHasNotifiedBilling(true);
      }
  }, [billingPaidAt, hasNotifiedBilling]);

  const handleCopyToClipboard = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(`已成功複製分享連結！\n${shareUrl}`);
        setShowShareModal(false);
        return;
      }
      const textArea = document.createElement("textarea"); textArea.value = shareUrl; document.body.appendChild(textArea); textArea.select();
      document.execCommand('copy'); 
      alert(`已成功複製分享連結！\n${shareUrl}`);
      document.body.removeChild(textArea); 
      setShowShareModal(false);
    } catch (err) { 
      alert(`請手動複製連結：\n${shareUrl}`); 
    }
  };

  const handleAudioUnlock = () => { setIsAudioUnlocked(true); if ('speechSynthesis' in window && settings.voice) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(`身分驗證成功，歡迎使用急診智能導航系統。`); utterance.lang = 'zh-TW'; utterance.rate = 0.9; window.speechSynthesis.speak(utterance); } };

  const handleShareClick = () => { setShowShareModal(true); playVoice('請讓家屬掃描畫面上的條碼，或點擊複製連結。進入前需輸入身分證後四碼。'); };

  const helpRequests = { 
    ivEmpty: alerts.some(a => a.patientId === currentPatient.id && a.type === 'ivEmpty'), 
    ivPain: alerts.some(a => a.patientId === currentPatient.id && a.type === 'ivPain'), 
    toilet: alerts.some(a => a.patientId === currentPatient.id && a.type === 'toilet'), 
    other: alerts.some(a => a.patientId === currentPatient.id && a.type === 'other'),
    sos: alerts.some(a => a.patientId === currentPatient.id && a.type === 'sos') 
  };

  useEffect(() => {
    let timer;
    if (showTriageBumpAlert) {
      timer = setTimeout(() => setShowTriageBumpAlert(false), 5000);
    }
    return () => clearTimeout(timer);
  }, [showTriageBumpAlert]);

  const findPath = (start, end, floorLayout) => {
    const queue = [[start]]; const visited = new Set([`${start[0]},${start[1]}`]); const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
    while(queue.length > 0) {
      const path = queue.shift(); const curr = path[path.length - 1];
      if (curr[0] === end[0] && curr[1] === end[1]) return path;
      for(let [dr, dc] of dirs) {
        const nr = curr[0] + dr; const nc = curr[1] + dc;
        if (nr >= 0 && nr < floorLayout.length && nc >= 0 && nc < floorLayout[0].length) {
          if ((floorLayout[nr][nc] === 1 || floorLayout[nr][nc] === 6 || (nr === end[0] && nc === end[1])) && !visited.has(`${nr},${nc}`)) {
            visited.add(`${nr},${nc}`); queue.push([...path, [nr, nc]]);
          }
        }
      }
    } 
    return [];
  };

  const handleNavigation = (destId) => {
    setActiveDestination(destId); setCurrentFloor('1F'); setNavigationState('navigating_1f');
    // 強制將起點設為大廳，確保無論哪種身份都有完整的地圖路線可看
    const startNode = [9, 7]; 
    let destNode;
    if (destId === 'icu') destNode = [3,1]; 
    else if (destId === 'find_patient') destNode = [3,10]; 
    else if (MAP_LANDMARKS[destId]) destNode = [MAP_LANDMARKS[destId].row, MAP_LANDMARKS[destId].col];
    else return; 

    setCalculatedPath(findPath(startNode, destNode, MAP_LAYOUT_1F));
    
    const destObj = NAV_DESTINATIONS.find(d => d.id === destId);
    const guidanceVoice = destId === 'find_patient' 
      ? '正在帶您尋找病患。請跟隨畫面上箭頭的指示直走。' 
      : (destObj?.guidance ? `正在為您導航至${destObj.label}。${destObj.guidance}` : `已開啟地圖導航，請跟隨畫面上箭頭的指示直走。`);
    
    playVoice(guidanceVoice);
  };

  useEffect(() => {
    const myCmd = commands.find(c => (c.patientId === currentPatient.id || c.patientId === 'GLOBAL') && !processedCmdsRef.current.has(c.id));
    if (myCmd) {
      processedCmdsRef.current.add(myCmd.id); 
      
      if (myCmd.action === 'custom_emergency') {
         setCustomEmergencyAlert(myCmd.message);
         triggerVibe([1000, 500, 1000, 500, 1000], true);
         playVoice(`緊急廣播：${myCmd.message}`, true);
         if(myCmd.patientId !== 'GLOBAL') ackCommand(myCmd.id);
         
         setTimeout(() => {
             setCustomEmergencyAlert(null);
         }, 5000);
      }
      else if (myCmd.action === 'triage_bump') { 
         setShowTriageBumpAlert(true); 
         playVoice('目前急診室有重大傷患正在進行急救，醫療團隊正全力搶救中，候診時間將展延，感謝您的體諒。'); 
         if(myCmd.patientId !== 'GLOBAL') ackCommand(myCmd.id); 
      } 
      else if (isPatientMode && !recallInfo && !showUrgentCall) {
         if (myCmd.action === 'urgent_call') { 
            setShowUrgentCall(true); 
            triggerVibe([1000, 500, 1000, 500, 1000], true);
            playVoice(`${currentPatient.name}！輪到您了！請立刻前往急診一診看診。`, true);
            ackCommand(myCmd.id); 
         } 
         else { 
            setRecallInfo({ type: myCmd.action, title: myCmd.action === 'nurse' ? '護理站正在找您' : 'X光室正在呼叫您', desc: '點擊此處開啟導航前往。', icon: myCmd.action==='nurse' ? '👩‍⚕️':'☢️', color: myCmd.action==='nurse'?'bg-indigo-600':'bg-sky-600' }); 
            triggerVibe([800, 400, 800]); 
            playVoice(`${currentPatient.name}您好，有單位正在呼叫您，請點擊畫面頂部提醒，跟隨指示前往。`); 
            ackCommand(myCmd.id); 
         }
      }
    }
  }, [commands, recallInfo, showUrgentCall, customEmergencyAlert, ackCommand, currentPatient.id, currentPatient.name, isPatientMode]);

  useEffect(() => {
    let rfidTimer;
    if (helpRequests.toilet && !isFamilyMode) {
      rfidTimer = setTimeout(() => { const existingAlert = alerts.find(a => a.patientId === currentPatient.id && a.type === 'toilet'); if (existingAlert) resolveAlert(existingAlert.id); updatePatientState(currentPatient.id, { rfid: 'active', location: '急診大廳' }); playVoice('系統偵測您已返回，為您解除暫離狀態。'); }, 12000); 
    }
    return () => clearTimeout(rfidTimer);
  }, [helpRequests.toilet, isAudioUnlocked, alerts, resolveAlert, currentPatient.id, updatePatientState, isFamilyMode]);

  const handleHelpRequest = (type) => {
    if (type === 'toilet') {
      if (helpRequests.toilet) { const existingAlert = alerts.find(a => a.patientId === currentPatient.id && a.type === 'toilet'); if (existingAlert) resolveAlert(existingAlert.id); updatePatientState(currentPatient.id, { rfid: 'active', location: '急診大廳' }); playVoice('歡迎回來。'); } 
      else { createAlert({ patientId: currentPatient.id, type: 'toilet', message: '已暫離前往洗手間', priority: 'low' }); updatePatientState(currentPatient.id, { rfid: 'away', location: '洗手間' }); playVoice('已為您保留號碼，請放心前往。'); }
    } else if (type === 'sos') { createAlert({ patientId: currentPatient.id, type: 'sos', message: '🚨病患發出緊急求救🚨', priority: 'high' }); triggerVibe([1000, 500, 1000]); playVoice('已發送緊急求救，護理人員將盡快抵達。'); } 
    else { createAlert({ patientId: currentPatient.id, type, message: type === 'ivEmpty' ? '點滴不滴/沒了' : type === 'ivPain' ? '漏血/會痛' : '其他需求', priority: type === 'ivEmpty' ? 'medium' : type === 'other' ? 'low' : 'high' }); playVoice('護理師已收到通知，請稍候。'); }
  };

  const handleLabNavigation = (labId) => {
    const labNavMapping = { blood: 'blood', urine: 'screening', ecg: 'ecg', xray: 'xray', us: 'us', ct: 'ct', mri: 'mri', other: null };
    const dest = labNavMapping[labId];
    if (dest) { setActiveTab('nav'); handleNavigation(dest); }
  };

  const handleEnterElevator = () => { setNavigationState('in_elevator'); playVoice('請搭乘電梯至 3 樓。'); };
  const handleArriveAt3F = () => { setCurrentFloor('3F'); setNavigationState('navigating_3f'); setCalculatedPath(findPath([3,1], [5,2], MAP_LAYOUT_3F)); playVoice('已抵達 3 樓。步出電梯後請直走，加護病房在您的左側。'); };

  const applyTransform = (t) => {
    transformRef.current = t;
    if (mapRef.current) {
      mapRef.current.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
    }
  };

  useEffect(() => {
    applyTransform(transformRef.current);
  }, [activeTab]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      startDragPos.current.isDragging = false;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      startDragPos.current.initialPinchDist = dist;
      startDragPos.current.initialScale = transformRef.current.scale;
    } else if (e.touches.length === 1) {
      startDragPos.current.isDragging = true;
      startDragPos.current.x = e.touches[0].clientX - transformRef.current.x;
      startDragPos.current.y = e.touches[0].clientY - transformRef.current.y;
    }
  };

  const handleTouchMove = (e) => {
    if (e.cancelable) e.preventDefault();
    const p = transformRef.current;
    
    if (e.touches.length === 2 && startDragPos.current.initialPinchDist > 0) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const newScale = Math.min(Math.max(0.3, startDragPos.current.initialScale * (dist / startDragPos.current.initialPinchDist)), 2.5);
      if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
      reqFrameRef.current = requestAnimationFrame(() => applyTransform({ x: p.x, y: p.y, scale: newScale }));
    } else if (startDragPos.current.isDragging && e.touches.length === 1) {
      if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
      reqFrameRef.current = requestAnimationFrame(() => applyTransform({
        x: e.touches[0].clientX - startDragPos.current.x,
        y: e.touches[0].clientY - startDragPos.current.y,
        scale: p.scale
      }));
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) startDragPos.current.initialPinchDist = 0;
    if (e.touches.length === 0) startDragPos.current.isDragging = false;
  };

  const handleMouseDown = (e) => {
    startDragPos.current.isDragging = true;
    startDragPos.current.x = e.clientX - transformRef.current.x;
    startDragPos.current.y = e.clientY - transformRef.current.y;
  };
  const handleMouseMove = (e) => {
    if (startDragPos.current.isDragging) {
      if (reqFrameRef.current) cancelAnimationFrame(reqFrameRef.current);
      reqFrameRef.current = requestAnimationFrame(() => applyTransform({
        x: e.clientX - startDragPos.current.x,
        y: e.clientY - startDragPos.current.y,
        scale: transformRef.current.scale
      }));
    }
  };
  const handleMouseUp = () => { startDragPos.current.isDragging = false; };
  const handleZoom = (dir) => {
    const p = transformRef.current;
    applyTransform({ ...p, scale: Math.min(Math.max(0.3, p.scale + (dir === 'in' ? 0.15 : -0.15)), 2.5) });
  };
  const resetMap = () => applyTransform({ x: 0, y: 0, scale: 0.6 });

  const getCellRendering = (row, col, cellType) => {
    const is1F = currentFloor === '1F'; 
    let labelText = null; let baseStyle = ''; let content = null; let destId = null;

    Object.entries(MAP_LANDMARKS).forEach(([k, v]) => {
      if (v.row === row && v.col === col) {
         if ((k === 'icu' && !is1F) || (k !== 'icu' && is1F)) {
            destId = k;
            if (k === 'er_entrance') labelText = '急診入口';
            else if (k === 'elevator') labelText = '電梯';
            else {
               const navDest = NAV_DESTINATIONS.find(d => d.id === k);
               if (navDest) labelText = navDest.label;
            }
         }
      }
    });

    const isDestLabel = Boolean(activeDestination && destId && ((activeDestination === destId) || (activeDestination === 'find_patient' && destId === 'nurse')));
    if (isDestLabel) {
        if ((isFamilyMode || isProxyMode) && activeDestination === 'find_patient' && destId === 'nurse') { content = '👴'; labelText = '病患位置'; } 
        else { const navDest = NAV_DESTINATIONS.find(d => d.id === destId); content = navDest ? navDest.icon : null; }
    }
    
    const isStart = (row === 9 && col === 7) && is1F;

    switch(cellType) {
      case 0: baseStyle = 'opacity-0'; break;
      case 1: baseStyle = isStart && is1F ? 'bg-emerald-400 z-20 shadow-[0_0_15px_#34d399]' : 'bg-stone-200 dark:bg-slate-800 border border-stone-300 dark:border-slate-700'; break;
      case 2: baseStyle = 'bg-stone-400 dark:bg-slate-700 shadow-[-1px_1px_0_#d6d3d1,-2px_2px_0_#d6d3d1,-3px_3px_0_#d6d3d1,-4px_4px_0_#a8a29e] border-t border-r border-stone-300 z-10 -translate-y-1 translate-x-1'; break;
      case 3: baseStyle = 'bg-amber-300 shadow-[-1px_1px_0_#fcd34d,-2px_2px_0_#fbbf24,-3px_3px_0_#f59e0b,-4px_4px_0_#d97706] z-10 -translate-y-1 translate-x-1'; break;
      case 4: baseStyle = 'bg-sky-300 shadow-[-1px_1px_0_#7dd3fc,-2px_2px_0_#38bdf8,-3px_3px_0_#0284c7,-4px_4px_0_#0369a1] z-10 -translate-y-1 translate-x-1'; break;
      case 5: baseStyle = 'bg-cyan-300 shadow-[-1px_1px_0_#67e8f9,-2px_2px_0_#22d3ee,-3px_3px_0_#0891b2,-4px_4px_0_#0e7490] z-10 -translate-y-1 translate-x-1'; break;
      case 6: baseStyle = 'bg-stone-300 shadow-[-1px_1px_0_#d6d3d1,-2px_2px_0_#a8a29e,-3px_3px_0_#78716c,-4px_4px_0_#57534e,-5px_5px_0_#44403c] z-20 -translate-y-2 translate-x-2'; break;
      case 7: baseStyle = 'bg-pink-300 shadow-[-1px_1px_0_#f9a8d4,-2px_2px_0_#f472b6,-3px_3px_0_#db2777,-4px_4px_0_#be185d] z-10 -translate-y-1 translate-x-1'; break;
      case 8: baseStyle = 'bg-rose-400 shadow-[-1px_1px_0_#fb7185,-2px_2px_0_#e11d48,-3px_3px_0_#be123c,-4px_4px_0_#9f1239] z-10 -translate-y-1 translate-x-1'; break;
      default: baseStyle = '';
    }

    if (isDestLabel && cellType !== 1) baseStyle += ' animate-pulse shadow-[0_0_25px_rgba(255,255,255,0.8)]';

    return (
      <div key={`${row}-${col}`} className={`w-8 h-8 sm:w-9 sm:h-9 relative transition-all duration-300 ${baseStyle}`} style={{ transformStyle: 'preserve-3d' }}>
        {content && <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: 'translateZ(40px)' }}><div className="text-4xl animate-bounce" style={{ transform: 'rotateZ(45deg) rotateX(-55deg)' }}>{content}</div></div>}
        {labelText && (
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ transform: `translateZ(${isDestLabel ? '150px' : '55px'})`, zIndex: isDestLabel ? 999 : 50 }}>
            <div className={`flex flex-col items-center origin-bottom transition-all duration-500 ${isDestLabel ? 'animate-bounce' : ''}`} style={{ transform: 'rotateZ(45deg) rotateX(-55deg)' }}>
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl transition-all ${isDestLabel ? 'bg-rose-500 border border-rose-300 scale-125 shadow-[0_10px_30px_rgba(244,63,94,0.8)]' : 'bg-slate-800 border border-slate-700/80'}`}>
                 <span className={`rounded-sm px-2 py-1 text-2xl ${isDestLabel ? 'bg-rose-400 text-white' : 'bg-amber-500 text-white'}`}>{content || '📍'}</span>
                 <span className="font-bold whitespace-nowrap text-white" style={{ fontSize: settings.elderMode ? '2rem' : '1.25rem' }}>{labelText}</span>
              </div>
              <div className={`w-1 ${isDestLabel ? 'h-10 bg-rose-400' : 'h-6 bg-slate-500'}`}></div>
            </div>
          </div>
        )}
        {isStart && (
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-[60]" style={{ transform: `translateZ(75px)` }}>
            <div className="flex flex-col items-center origin-bottom transition-all duration-500 animate-bounce scale-110" style={{ transform: 'rotateZ(45deg) rotateX(-55deg)' }}>
              <div className="bg-emerald-500/95 border-2 border-emerald-300 rounded-full px-3 py-1 shadow-lg flex items-center gap-1"><span className="text-white font-black text-sm">📍 起點</span></div>
              <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-400 to-transparent"></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFootprints = () => {
    let elements = [];
    if (calculatedPath.length < 2) return null;

    const pathData = calculatedPath.map((p, i) => `${i===0?'M':'L'} ${p[1]*36+18},${p[0]*36+18}`).join(' ');
    elements.push(<path key="base-path" d={pathData} fill="none" stroke="#bae6fd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 8" opacity="0.6"/>);

    for (let i = 0; i < calculatedPath.length - 1; i++) {
       const p1 = calculatedPath[i];
       const p2 = calculatedPath[i+1];
       const y1 = p1[0] * 36 + 18, x1 = p1[1] * 36 + 18;
       const y2 = p2[0] * 36 + 18, x2 = p2[1] * 36 + 18;
       
       const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI) + 90;
       const midX = (x1 + x2) / 2;
       const midY = (y1 + y2) / 2;

       elements.push(
          <g key={`step-${i}`} transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
             <polygon className="arrow-step" style={{ animationDelay: `${i * 0.2}s` }} points="-8,6 0,-10 8,6 0,2" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1"/>
          </g>
       );
    }
    
    const lastP = calculatedPath[calculatedPath.length - 1];
    if (lastP) {
       elements.push(
          <g key="dest" transform={`translate(${lastP[1]*36+18}, ${lastP[0]*36+18})`}>
             <circle cx="0" cy="0" r="14" fill="#0ea5e9" className="animate-ping" opacity="0.5" />
             <circle cx="0" cy="0" r="6" fill="#0ea5e9" />
          </g>
       );
    }
    return elements;
  };

  const triage = getTriageStyle(currentPatient.triageLevel || 3);

  return (
    <div className="flex justify-center items-start sm:p-4 relative overflow-hidden h-[100dvh] bg-gradient-to-br from-slate-50 via-sky-50 to-amber-50 dark:from-slate-950 dark:via-sky-950 dark:to-slate-900">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-400/20 dark:bg-teal-500/10 rounded-full blur-[80px]"></div>
         <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] bg-sky-400/20 dark:bg-sky-500/10 rounded-full blur-[100px]"></div>
         <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-amber-400/15 dark:bg-amber-500/10 rounded-full blur-[60px]"></div>
      </div>

      <div className="w-full max-w-md bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl sm:rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.1)] sm:border border-white/50 dark:border-slate-700/50 flex flex-col h-full relative z-10 overflow-hidden">
        
        {systemConfig?.marqueeText && (
           <div className="bg-sky-600 text-sky-50 overflow-hidden relative flex items-center px-3 py-2 z-[60] shadow-sm">
              <Info className="w-5 h-5 shrink-0 mr-2 animate-pulse text-sky-200"/>
              <div className="flex-1 overflow-hidden relative h-6">
                 <div className="animate-marquee absolute whitespace-nowrap text-sm font-bold tracking-widest">
                    {systemConfig.marqueeText}
                 </div>
              </div>
           </div>
        )}

        {billingPaidAt && (
          <div className="bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700 p-4 flex items-center justify-between shadow-sm z-40 animate-[fadeIn_0.5s_ease-out]">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
               <Clock className="w-6 h-6 animate-pulse" />
               <span className="font-bold text-base leading-snug">⚠️ 已完成批價<br/><span className="text-xs font-normal">系統將於 {new Date(billingPaidAt + 30 * 60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 自動註銷連結</span></span>
            </div>
          </div>
        )}

        {showTriageBumpAlert && (
          <div className="absolute top-4 left-4 right-4 z-[90] animate-[fadeIn_0.3s_ease-out]">
             <div className="bg-red-600/95 backdrop-blur-xl border border-red-400 rounded-2xl p-5 shadow-[0_10px_30px_rgba(220,38,38,0.5)] flex items-start gap-4">
                <AlertTriangle className="w-12 h-12 text-white shrink-0 animate-bounce" />
                <div className="text-white"><h3 className="font-black text-2xl mb-1 tracking-wider">一級急救處置中</h3><p className="font-medium text-base opacity-95 leading-snug">醫療團隊全力搶救，候診將自動展延。</p></div>
             </div>
          </div>
        )}

        {/* 護理站呼叫提醒橫幅，加入點擊導航功能 */}
        {recallInfo && (
          <div className="absolute top-4 left-4 right-4 z-[90] animate-[fadeIn_0.3s_ease-out]">
             <div onClick={() => { setActiveTab('nav'); handleNavigation(recallInfo.type); setRecallInfo(null); }} className={`${recallInfo.color} backdrop-blur-xl border border-white/30 rounded-2xl p-5 shadow-xl flex items-start gap-4 cursor-pointer hover:scale-[1.02] transition-transform`}>
                <div className="text-5xl animate-bounce">{recallInfo.icon}</div>
                <div className="text-white flex-1"><h3 className="font-black text-2xl mb-1">{recallInfo.title}</h3><p className="font-medium text-base opacity-95">{recallInfo.desc}</p></div>
                <button onClick={(e) => { e.stopPropagation(); setRecallInfo(null); }} className="text-white/70 hover:text-white"><X className="w-8 h-8"/></button>
             </div>
          </div>
        )}

        {showUrgentCall && (
          <div className="absolute inset-0 z-[100] bg-rose-600 flex flex-col items-center justify-center p-6 animate-pulse">
            <AlertTriangle className="w-32 h-32 text-white mb-6" /><h2 className="text-5xl font-black text-white mb-4">輪到您了！</h2><p className="text-2xl text-white text-center mb-8">請立刻前往急診一診看診</p>
            <button onClick={() => setShowUrgentCall(false)} className="bg-white text-rose-600 font-black text-3xl py-5 px-12 rounded-2xl shadow-xl hover:scale-105 transition-transform">我知道了</button>
          </div>
        )}

        {customEmergencyAlert && (
          <div className="absolute top-0 left-0 right-0 h-[50%] z-[200] bg-red-600 rounded-b-[3rem] flex flex-col items-center justify-center p-8 shadow-[0_20px_50px_rgba(220,38,38,0.5)] animate-[slideDownHalf_0.4s_ease-out]">
            <Megaphone className="w-20 h-20 text-white mb-4 animate-bounce" />
            <h2 className="text-4xl font-black text-white mb-4 tracking-widest">緊急廣播</h2>
            <p className="text-2xl text-white text-center mb-8 font-bold leading-relaxed line-clamp-4">{customEmergencyAlert}</p>
            <button onClick={() => setCustomEmergencyAlert(null)} className="bg-white text-red-600 font-black text-2xl py-4 px-10 rounded-2xl shadow-xl hover:scale-105 transition-transform active:scale-95">我已了解</button>
          </div>
        )}

        {!isAudioUnlocked && (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 z-[100] flex flex-col items-center justify-center p-8 backdrop-blur-2xl">
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mb-8 animate-pulse ${isProxyMode ? 'bg-purple-100/50 border-purple-300 text-purple-500' : isFamilyMode ? 'bg-amber-100/50 border-amber-300 text-amber-500' : 'bg-emerald-100/50 border-emerald-300 text-emerald-500'}`}>
               {isProxyMode ? <PenTool className="w-16 h-16"/> : <Mic className="w-16 h-16" />}
            </div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-widest text-center">{isProxyMode ? '家屬代理人授權' : isFamilyMode ? '家屬探病服務' : '急診智能導航系統'}</h2>
            <p className="text-slate-600 dark:text-sky-200/80 text-2xl text-center mb-10 leading-relaxed">驗證成功，病患為：<br/><b className="text-slate-900 dark:text-white text-4xl mt-3 block">{currentPatient.name}</b></p>
            <button onClick={handleAudioUnlock} className={`font-black text-3xl py-5 px-4 w-full rounded-2xl shadow-lg hover:scale-105 transition-transform ${isProxyMode ? 'bg-purple-500 text-white' : isFamilyMode ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>點擊進入系統</button>
          </div>
        )}

        <header className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-b border-white/50 dark:border-slate-700/50 px-5 py-4 shrink-0 flex flex-col gap-2 z-30 transition-colors shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sky-600 dark:text-sky-400 text-base font-bold flex items-center gap-2"><Activity className="w-5 h-5"/> 某某醫學中心</div>
            <div className="flex items-center gap-2">
              <HeaderSettings settings={settings} toggleSetting={toggleSetting} />
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white">{currentPatient.name}</h1>
              {isProxyMode ? <span className="bg-purple-50 text-purple-600 text-sm font-bold px-3 py-1 rounded-full border border-purple-200">👨‍⚖️ 代理人授權</span> 
               : isFamilyMode ? <span className="bg-amber-50 text-amber-600 text-sm font-bold px-3 py-1 rounded-full border border-amber-200">👨‍👩‍👧 家屬模式</span> 
               : <span className="bg-emerald-50 text-emerald-600 text-sm font-bold px-3 py-1 rounded-full border border-emerald-200">📍 即時定位</span>}
            </div>
            <button onClick={onLogout} className="p-2 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl text-slate-500 hover:text-rose-500 transition-colors"><LogOut className="w-6 h-6"/></button>
          </div>
          {isPatientMode && (
            <button onClick={handleShareClick} className="w-full mt-3 bg-indigo-50/80 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300 text-sm font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-indigo-200/50 hover:bg-indigo-100 transition-colors"><Share2 className="w-5 h-5" /> 點擊產生家屬探視連結</button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto bg-transparent scroll-smooth pb-6">
          
          {/* ================= 1. 看進度 ================= */}
          {activeTab === 'progress' && (
            <div className="p-4 space-y-4 animate-[fadeIn_0.3s_ease-out]">
              <div className={`rounded-[2rem] p-6 shadow-lg dark:shadow-2xl relative overflow-hidden border backdrop-blur-md ${isFamilyMode ? 'bg-gradient-to-b from-amber-50/80 to-white/80 dark:from-amber-900/40 border-amber-200/50' : currentStep === 3 ? 'bg-gradient-to-b from-emerald-50/80 to-white/80 dark:from-emerald-900/50 border-emerald-200/50' : 'bg-gradient-to-b from-sky-50/80 to-white/80 dark:from-sky-900/40 border-sky-200/50'}`}>
                <div className={`mb-6 p-4 rounded-2xl border ${triage.bg} ${triage.border} relative overflow-hidden backdrop-blur-sm bg-opacity-70`}>
                  <div className="flex items-center justify-between mb-2"><span className={`font-bold text-xl ${triage.color}`}>{currentStatus}</span><span className={`text-xs font-bold px-3 py-1.5 rounded-md text-white ${triage.dot}`}>檢傷 {triage.name.split(' ')[0]}</span></div>
                  <p className={`text-base font-bold ${triage.color} opacity-95`}>{triage.msg}</p>
                </div>
                <div className="text-center mb-6"><div className="text-[80px] font-black text-slate-900 dark:text-white leading-none tracking-wider drop-shadow-sm">{currentPatient.id}</div></div>
                {currentStep === 3 && (
                  <div className="bg-rose-50/80 dark:bg-rose-500/20 border border-rose-200/50 rounded-2xl p-4 text-center mb-4 animate-pulse backdrop-blur-sm">
                    <p className="text-rose-600 font-bold text-xl flex items-center justify-center gap-2"><AlertTriangle className="w-6 h-6"/> 報告已全數出爐</p>
                    <p className="text-rose-500 text-base mt-1">請於候診區等待叫號</p>
                  </div>
                )}
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-6 flex justify-center items-center border border-white/50 dark:border-slate-700 text-center shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-md">
                  <div>
                    <div className={`${currentStep === 3 ? 'text-emerald-600' : 'text-sky-600'} text-xl font-bold`}>前方等待人數</div>
                    <div className={`text-6xl font-black mt-2 ${currentStep === 3 ? 'text-emerald-500' : 'text-amber-500'}`}>{waitingCount} <span className="text-3xl text-slate-900 dark:text-white">人</span></div>
                  </div>
                </div>
              </div>

              {reminders?.length > 0 && isPatientMode && (
                <div className="space-y-3 mb-4 animate-[fadeIn_0.5s_ease-out]">
                   {reminders.map(rId => {
                      const r = REMINDER_TYPES.find(x => x.id === rId);
                      if(!r) return null;
                      return (
                         <div key={rId} className="bg-rose-50/90 dark:bg-rose-500/20 border border-rose-200/50 dark:border-rose-500/50 rounded-3xl p-4 relative overflow-hidden shadow-sm flex flex-col backdrop-blur-md">
                           <div className="absolute inset-0 bg-rose-100/30 dark:bg-rose-500/5 animate-pulse"></div>
                           <div className="relative z-10 flex items-center gap-4 mb-3">
                             <div className="w-14 h-14 bg-white/90 dark:bg-rose-500/30 rounded-full flex items-center justify-center shrink-0 text-3xl shadow-sm">{r.icon}</div>
                             <div>
                                <h3 className="text-rose-600 dark:text-rose-400 text-base font-bold tracking-widest">護理站要求：</h3>
                                <p className="text-slate-900 dark:text-white text-3xl font-black underline decoration-rose-500 decoration-4 underline-offset-4">{r.label}</p>
                             </div>
                           </div>
                           <div className="relative z-10 bg-white/80 dark:bg-slate-900/80 rounded-xl p-4 border border-white/50 dark:border-slate-700 backdrop-blur-sm">
                              <div className="text-slate-700 dark:text-sky-200 text-base leading-relaxed flex gap-2 items-start mb-3">
                                 <Volume2 className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                                 <p>{DEFAULT_EXPLANATIONS[r.label]}</p>
                              </div>
                              <button onClick={() => playVoice(DEFAULT_EXPLANATIONS[r.label])} className="w-full flex items-center justify-center gap-2 bg-sky-50/80 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-base py-3 hover:bg-sky-100 border border-sky-100/50 rounded-lg transition-colors mt-2"><Mic className="w-6 h-6"/> 聽取語音說明</button>
                           </div>
                         </div>
                      );
                   })}
                </div>
              )}

              <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-[2rem] p-5 shadow-sm">
                <h3 className="text-base text-sky-600 dark:text-sky-400 font-mono tracking-widest uppercase mb-6 flex items-center gap-2"><Activity className="w-5 h-5"/> 就診流程</h3>
                <div className="flex justify-between items-center relative px-2">
                  <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1.5 bg-slate-200/50 dark:bg-slate-700/50 z-0"></div>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 h-1.5 bg-sky-500 z-0 transition-all duration-500" style={{ width: `calc(${(currentStep / (MED_STEPS.length - 1)) * 100}% - 2rem)` }}></div>
                  {MED_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStep; const isActive = idx === currentStep;
                    return (
                      <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all duration-300 backdrop-blur-md ${isCompleted ? 'bg-sky-500 text-white shadow-md' : isActive ? 'bg-white border-[3px] border-sky-500 text-sky-600 shadow-md animate-pulse' : 'bg-slate-100/80 text-slate-400 border border-slate-200'}`}>
                          {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : (idx + 1)}
                        </div>
                        <span className={`text-xs font-bold ${isActive ? 'text-sky-600' : isCompleted ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'} text-center max-w-[4rem]`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {currentStep >= 1 && currentStep <= 3 && (
                <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 rounded-[2rem] p-5 shadow-sm animate-[fadeIn_0.5s_ease-out]">
                  <h3 className="text-base text-sky-600 font-mono tracking-widest uppercase mb-4 flex items-center gap-2"><FileText className="w-5 h-5"/> 檢驗與報告進度</h3>
                  <div className="flex flex-col gap-3">
                     {LAB_TYPES.map(lab => {
                         const data = labStatus[lab.id];
                         const IconComp = lab.icon;
                         const hasNavMapping = ['blood', 'urine', 'ecg', 'xray', 'us', 'ct', 'mri'].includes(lab.id);
                         if (!data || data.status === 'unprescribed') return null;
                         
                         let cCls = data.status==='reported'?'text-emerald-600':data.status==='done'?'text-teal-600':lab.color==='rose'?'text-rose-600':'text-amber-600';
                         const statusLabel = data.status === 'reported' ? '報告已出' : data.status === 'done' ? '檢驗完成' : data.status === 'pending' ? '待處理' : '處理中';
                         
                         return (
                           <div key={lab.id} className={`flex flex-col p-4 rounded-2xl border bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all ${data.status === 'reported' ? 'border-emerald-300 bg-emerald-50/50' : 'border-white/60 dark:border-slate-700'}`}>
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                 <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${lab.iconBgCls} ${cCls}`}><IconComp className="w-7 h-7" /></div>
                                 <div><div className="font-bold text-lg text-slate-900 dark:text-slate-200">{lab.label}</div><div className="text-sm text-slate-500 dark:text-slate-400">{data.text}</div></div>
                               </div>
                               <div className="text-right flex flex-col items-end justify-center gap-2">
                                 <div className={`font-bold text-base flex items-center gap-1 ${cCls}`}>{data.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}{statusLabel}</div>
                                 {(data.status === 'pending' || data.status === 'processing') && hasNavMapping && (
                                     <button onClick={() => handleLabNavigation(lab.id)} className="bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center gap-1 shadow-sm transition-all animate-[fadeIn_0.3s_ease-out] active:scale-95"><MapPin className="w-4 h-4"/> 導航前往</button>
                                 )}
                               </div>
                             </div>
                             <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-4 overflow-hidden flex">
                                <div className={`h-full rounded-l-full transition-all duration-1000 ${data.status === 'reported' ? 'bg-emerald-500 w-full rounded-r-full' : data.status === 'done' ? 'bg-teal-500 w-[75%]' : data.status === 'processing' ? 'bg-amber-500 w-1/2 animate-pulse' : 'bg-sky-500 w-1/4'}`}></div>
                             </div>
                           </div>
                         );
                     })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= 2. 找路 ================= */}
          {activeTab === 'nav' && (
            <div className="flex flex-col h-full animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-stone-200/50 dark:bg-slate-800/50 flex flex-col items-center justify-center overflow-hidden relative shadow-inner border-b border-stone-300/50 dark:border-slate-700/50 flex-1 min-h-[300px]">
                <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
                  <button onClick={() => handleZoom('in')} className="bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-md"><ZoomIn className="w-6 h-6"/></button>
                  <button onClick={() => handleZoom('out')} className="bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-md"><ZoomOut className="w-6 h-6"/></button>
                  <button onClick={resetMap} className="bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-md"><Maximize className="w-6 h-6"/></button>
                </div>
                {activeDestination === 'icu' && currentFloor === '1F' && navigationState !== 'in_elevator' && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 w-full px-8">
                    <button onClick={handleEnterElevator} className="w-full bg-emerald-500/90 backdrop-blur-md border border-emerald-400 text-white font-black py-4 rounded-2xl shadow-[0_8px_30px_rgba(16,185,129,0.4)] animate-bounce flex items-center justify-center gap-2"><ArrowUpCircle className="w-6 h-6" /> 前往 3 樓加護病房</button>
                  </div>
                )}
                {navigationState === 'in_elevator' && (
                  <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-auto">
                    <ArrowUpCircle className="w-24 h-24 text-amber-500 mb-6 animate-bounce" /><h2 className="text-3xl font-bold text-slate-900 mb-8">請搭乘至 3 樓</h2>
                    <button onClick={handleArriveAt3F} className="bg-emerald-500 text-white font-bold py-4 px-10 rounded-2xl active:scale-95 text-xl">我到了 (3F)</button>
                  </div>
                )}
                
                <div className="absolute inset-0 z-30 cursor-move" 
                     onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
                     onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                     style={{ touchAction: 'none' }}
                >
                  <div ref={mapRef} className="w-full h-full flex items-center justify-center will-change-transform" style={{ transformStyle: 'preserve-3d' }}>
                    <div className="relative flex flex-col" style={{ transform: 'rotateX(55deg) rotateZ(-45deg)', transformStyle: 'preserve-3d' }}>
                      {(currentFloor === '1F' ? MAP_LAYOUT_1F : MAP_LAYOUT_3F).map((rowArr, rIdx) => (
                        <div key={`r-${rIdx}`} className="flex" style={{ transformStyle: 'preserve-3d' }}>{rowArr.map((cType, cIdx) => getCellRendering(rIdx, cIdx, cType))}</div>
                      ))}
                      
                      {calculatedPath.length > 0 && (
                         <svg className="absolute inset-0 pointer-events-none z-40" style={{ width: '100%', height: '100%', overflow: 'visible', transform: 'translateZ(1px)' }}>
                            {renderFootprints()}
                         </svg>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {activeDestination && navigationState.includes('navigating') && (
                  <div className="bg-sky-50 dark:bg-sky-900/30 p-4 border-b border-sky-100 dark:border-sky-800 flex gap-3 items-start shrink-0 shadow-sm z-50">
                     <div className="bg-sky-200 dark:bg-sky-700 p-2 rounded-full mt-0.5"><Navigation className="text-sky-700 dark:text-sky-300 w-6 h-6"/></div>
                     <p className="text-sky-800 dark:text-sky-200 text-base font-bold leading-relaxed">
                        {activeDestination === 'find_patient' ? (
                          <>正在帶您尋找<span className="text-sky-600 dark:text-sky-300 underline underline-offset-4 decoration-2 mx-1">病患位置</span>。請跟隨地圖上的箭頭指示前進。</>
                        ) : (
                          <>正在為您導航至 <span className="text-sky-600 dark:text-sky-300 underline underline-offset-4 decoration-2 mx-1">{NAV_DESTINATIONS.find(d=>d.id===activeDestination)?.label || '目標'}</span>。{NAV_DESTINATIONS.find(d=>d.id===activeDestination)?.guidance || '請跟隨地圖上的箭頭指示前進。'}</>
                        )}
                     </p>
                  </div>
              )}

              {/* 垂直滾動直式選單 (加強觸控與滾動設定，解鎖家屬端選單) */}
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-10 shrink-0 border-t border-white/50 dark:border-slate-700/50 pb-6 pt-4 w-full">
                <div className="text-sm text-slate-500 font-bold px-4 mb-3">您要去哪裡？</div>
                <div className="flex flex-col gap-3 px-4 pb-4 overflow-y-auto max-h-[40vh] w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {(isFamilyMode || isProxyMode) && (
                      <button onClick={() => handleNavigation('find_patient')} className={`w-full p-4 rounded-2xl flex items-center justify-start gap-4 transition-all border shadow-sm touch-manipulation ${activeDestination === 'find_patient' ? 'bg-amber-100/90 border-2 border-amber-400 text-amber-700 scale-[1.02]' : 'bg-amber-50/90 border-amber-300 text-amber-700 hover:bg-amber-100'}`}>
                         <span className="text-4xl drop-shadow-sm leading-none pointer-events-none shrink-0">👤</span>
                         <span className="text-xl font-bold pointer-events-none">帶我去找病患</span>
                      </button>
                  )}
                  {NAV_DESTINATIONS.map(dest => (
                      <button key={dest.id} onClick={() => handleNavigation(dest.id)} className={`w-full p-4 rounded-2xl flex items-center justify-start gap-4 transition-all border shadow-sm touch-manipulation ${activeDestination === dest.id ? 'bg-indigo-100/90 border-2 border-indigo-400 text-indigo-700 scale-[1.02]' : 'bg-white/90 border-slate-200 hover:bg-slate-50'}`}>
                         <span className="text-4xl drop-shadow-sm leading-none pointer-events-none shrink-0">{dest.icon}</span>
                         <span className="text-xl font-bold text-slate-700 pointer-events-none">{dest.label}</span>
                      </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= 3. 要幫忙 ================= */}
          {activeTab === 'help' && (isPatientMode || isProxyMode) && (
            <div className="p-4 space-y-6 animate-[fadeIn_0.3s_ease-out]">
              
              {isProxyMode && (
                <div className="bg-purple-100 border border-purple-300 p-4 rounded-2xl flex items-start gap-3">
                   <PenTool className="text-purple-600 shrink-0 mt-1"/>
                   <div><h3 className="font-bold text-purple-800 text-lg">法定代理人簽署專區</h3><p className="text-sm text-purple-600 mt-1">您已取得護理站授權，可代為簽署下方同意書。為避免誤報，此模式已隱藏緊急求救功能。</p></div>
                </div>
              )}

              {isPatientMode && (
                 <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => handleHelpRequest('toilet')} className={`col-span-2 p-6 rounded-[1.5rem] flex items-center gap-4 backdrop-blur-md border shadow-sm transition-all ${helpRequests.toilet ? 'bg-amber-100/90 border-amber-400 text-amber-800' : 'bg-white/70 border-white/50 text-slate-800 hover:bg-white/90'} active:scale-95`}>
                         <span className="text-6xl">{helpRequests.toilet ? '🚶‍♂️' : '🚻'}</span>
                         <div className="text-left ml-2"><span className="text-2xl font-bold block mb-1">{helpRequests.toilet ? '已暫離前往洗手間' : '去廁所 / 暫離'}</span><span className="text-sm opacity-80">{helpRequests.toilet ? '點擊可解除狀態' : '通知護理站為您保留號碼'}</span></div>
                     </button>
                     <button onClick={() => handleHelpRequest('ivEmpty')} disabled={helpRequests.ivEmpty} className={`p-6 rounded-[1.5rem] flex flex-col items-center gap-4 backdrop-blur-md border shadow-sm transition-all ${helpRequests.ivEmpty ? 'bg-amber-50/90 border-amber-300/50 text-amber-700 cursor-not-allowed' : 'bg-white/70 border-white/50 active:scale-95 text-slate-800 hover:bg-white/90'}`}>
                         <span className="text-5xl">{helpRequests.ivEmpty ? '⏳' : '💧'}</span><span className="font-bold text-xl">{helpRequests.ivEmpty ? '已通知護理師' : '點滴沒了'}</span>
                     </button>
                     <button onClick={() => handleHelpRequest('ivPain')} disabled={helpRequests.ivPain} className={`p-6 rounded-[1.5rem] flex flex-col items-center gap-4 backdrop-blur-md border shadow-sm transition-all ${helpRequests.ivPain ? 'bg-amber-50/90 border-amber-300/50 text-amber-700 cursor-not-allowed' : 'bg-white/70 border-white/50 active:scale-95 text-slate-800 hover:bg-white/90'}`}>
                         <span className="text-5xl">{helpRequests.ivPain ? '⏳' : '🩹'}</span><span className="font-bold text-xl">{helpRequests.ivPain ? '已通知護理師' : '漏血/會痛'}</span>
                     </button>
                     {/* 新增其他需求按鈕 */}
                     <button onClick={() => handleHelpRequest('other')} disabled={helpRequests.other} className={`col-span-2 p-6 rounded-[1.5rem] flex items-center justify-center gap-4 backdrop-blur-md border shadow-sm transition-all ${helpRequests.other ? 'bg-amber-50/90 border-amber-300/50 text-amber-700 cursor-not-allowed' : 'bg-white/70 border-white/50 active:scale-95 text-slate-800 hover:bg-white/90'}`}>
                         <span className="text-5xl">{helpRequests.other ? '⏳' : '💬'}</span><span className="font-bold text-2xl">{helpRequests.other ? '已通知護理師' : '其他需求'}</span>
                     </button>
                     
                     <button onClick={() => handleHelpRequest('sos')} disabled={!sosEnabled || helpRequests.sos} className={`col-span-2 p-6 rounded-[1.5rem] flex items-center gap-4 border transition-transform backdrop-blur-md ${helpRequests.sos ? 'bg-amber-500/90 border-amber-400 text-white cursor-not-allowed' : !sosEnabled ? 'bg-slate-100/50 text-slate-400 border-slate-200/50 cursor-not-allowed' : 'bg-gradient-to-r from-rose-500/90 to-red-500/90 border-rose-400 text-white active:scale-95 shadow-lg'}`}>
                         <Power className="w-12 h-12 ml-2" />
                         <div className="text-left ml-4"><span className="text-3xl font-black block tracking-wider mb-1">緊急求救 SOS</span><span className="text-sm opacity-90">{helpRequests.sos ? '🚨 救援已派發，請稍候' : !sosEnabled ? '未開放此功能' : '點擊立即通知護理站'}</span></div>
                     </button>
                 </div>
              )}

              {isPatientMode && (
                 <div className="pt-4 border-t border-sky-200/50 dark:border-sky-500/20">
                   <div className="text-sm text-sky-600 tracking-widest uppercase flex items-center gap-3 mb-4"><span>❓ 常見問題 Q&A</span><div className="flex-1 h-[1px] bg-sky-200/50"></div></div>
                   <div className="space-y-3">
                     {FAQS.map((faq, idx) => (
                        <div key={idx} className="bg-white/70 dark:bg-slate-800/70 rounded-[1.2rem] border border-white/50 dark:border-slate-700 overflow-hidden backdrop-blur-md shadow-sm transition-all duration-300">
                           <button onClick={() => { setOpenFaqIndex(openFaqIndex === idx ? null : idx); if(openFaqIndex !== idx) playVoice(faq.a); }} className="w-full p-5 flex items-center justify-between text-left font-bold text-slate-800 dark:text-slate-200">
                              <span className="flex items-start gap-3"><span className="text-emerald-600 bg-emerald-100/80 dark:bg-emerald-900/40 dark:text-emerald-400 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-black shrink-0 mt-0.5">Q</span> <span className="leading-snug text-lg">{faq.q}</span></span>
                              {openFaqIndex === idx ? <ChevronUp className="w-6 h-6 text-slate-400 shrink-0" /> : <ChevronDown className="w-6 h-6 text-slate-400 shrink-0" />}
                           </button>
                           {openFaqIndex === idx && (
                              <div className="px-5 pb-5 pt-1 text-slate-600 dark:text-slate-400 text-base flex items-start gap-3 animate-[fadeIn_0.2s_ease-out]">
                                 <span className="text-amber-600 bg-amber-100/80 dark:bg-amber-900/40 dark:text-amber-400 w-8 h-8 flex items-center justify-center rounded-lg text-sm font-black shrink-0">A</span>
                                 <p className="pt-0.5 font-medium leading-relaxed">{faq.a}</p>
                              </div>
                           )}
                        </div>
                     ))}
                   </div>
                 </div>
              )}

              <div className="pt-4 border-t border-sky-200/50 dark:border-sky-500/20">
                <div className="text-sm text-sky-600 tracking-widest uppercase flex items-center gap-3 mb-4"><span>📄 電子同意書簽署</span><div className="flex-1 h-[1px] bg-sky-200/50"></div></div>
                <div className="grid grid-cols-2 gap-4">
                   {CONSENT_TYPES.map(c => {
                       const status = consents[c.id] || 'disabled';
                       return (
                          <button key={c.id} disabled={status === 'disabled'} onClick={() => setActiveConsentModal(c.id)} className={`p-5 rounded-[1.5rem] flex flex-col items-center gap-3 border backdrop-blur-md ${status === 'disabled' ? 'bg-white/40 border-white/50 text-slate-400 opacity-70' : status === 'pending' ? 'bg-amber-50/90 border-amber-300 text-amber-700 animate-pulse shadow-sm' : 'bg-emerald-50/90 border-emerald-300 text-emerald-700 shadow-sm'}`}>
                             <FileText className="w-10 h-10" />
                             <span className="font-bold text-base text-center">{c.label}</span>
                             <span className="text-sm bg-white/60 px-4 py-1.5 rounded-full">{status === 'disabled' ? '未開立' : status === 'pending' ? '待簽署' : '已完成'}</span>
                          </button>
                       )
                   })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-white/50 dark:border-slate-700/50 flex justify-around items-center py-3 pb-8 px-3 z-40 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <button onClick={() => {setActiveTab('progress'); playVoice('查看就診與報告進度');}} className={`flex flex-col items-center py-3 rounded-2xl transition-colors ${(isFamilyMode || isProxyMode) ? 'w-[45%]' : 'w-[30%]'} ${activeTab === 'progress' ? 'bg-sky-100/80 text-sky-600 border border-sky-200/50' : 'text-slate-500 hover:bg-slate-100/50'}`}><Activity className="w-7 h-7 mb-1" /><span className="font-bold text-sm">看進度</span></button>
          <button onClick={() => {setActiveTab('nav'); playVoice('開啟醫院地圖導航');}} className={`flex flex-col items-center py-3 rounded-2xl transition-colors ${(isFamilyMode || isProxyMode) ? 'w-[45%]' : 'w-[30%]'} ${activeTab === 'nav' ? 'bg-sky-100/80 text-sky-600 border border-sky-200/50' : 'text-slate-500 hover:bg-slate-100/50'}`}><MapPin className="w-7 h-7 mb-1" /><span className="font-bold text-sm">找路</span></button>
          {(!isFamilyMode) && <button onClick={() => {setActiveTab('help'); playVoice(isProxyMode ? '進入代理人簽署專區' : '開啟求助與常見問題功能');}} className={`flex flex-col items-center w-[30%] py-3 rounded-2xl relative transition-colors ${activeTab === 'help' ? 'bg-sky-100/80 text-sky-600 border border-sky-200/50' : 'text-slate-500 hover:bg-slate-100/50'}`}>{Object.values(consents).includes('pending') && <div className="absolute top-2 right-6 w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>}{isProxyMode ? <PenTool className="w-7 h-7 mb-1" /> : <HandHelping className="w-7 h-7 mb-1" />}<span className="font-bold text-sm">{isProxyMode ? '代簽署' : '要幫忙'}</span></button>}
        </div>

        {activeConsentModal && (
           <div className="absolute inset-0 z-[80] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
              <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col overflow-hidden h-[70vh]">
                 <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:bg-slate-900"><h3 className="font-black text-xl flex items-center gap-2"><FileText className="w-6 h-6 text-sky-500" /> {CONSENT_TYPES.find(c=>c.id===activeConsentModal)?.label}</h3><button onClick={() => setActiveConsentModal(null)}><X className="w-7 h-7"/></button></div>
                 {consents[activeConsentModal] === 'signed' ? (
                     <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><CheckCircle2 className="w-20 h-20 text-emerald-500 mb-4" /><h4 className="text-2xl font-bold mb-2">已完成數位簽署</h4><p className="text-base text-slate-500">已單向傳輸並由 HIS 系統落地歸檔。</p></div>
                 ) : (
                     <>
                         <div className="flex-1 p-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 m-6 rounded-2xl bg-slate-50 dark:bg-slate-900 text-slate-400 relative">
                            <PenTool className="w-20 h-20 mb-4 text-sky-500" /><p className="font-bold text-slate-600 text-xl mb-2">數位簽章整合區</p><p className="text-center text-sm">請在此框內簽名。</p>
                         </div>
                         <div className="p-5 border-t border-slate-100"><button onClick={() => { updatePatientState(currentPatient.id, { consents: { ...consents, [activeConsentModal]: 'signed' } }); setTimeout(() => setActiveConsentModal(null), 1500); playVoice('簽署完成，已安全送出。'); }} className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-xl font-bold text-xl active:scale-95"><PenTool className="w-6 h-6 inline mr-2"/> {isProxyMode ? '代理人確認送出' : '模擬簽署確認'}</button></div>
                     </>
                 )}
              </div>
           </div>
        )}

        {showShareModal && (
          <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl relative">
               <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4"><X className="w-7 h-7"/></button>
               <h3 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">家屬探病連結</h3>
               <p className="text-slate-500 text-base mb-6">請掃描條碼或複製連結</p>
               <div className="bg-white p-2 rounded-2xl mb-6 aspect-square w-48 border-2 mx-auto flex items-center justify-center min-h-[180px]">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`} alt="QR Code" className="w-full h-full object-contain" />
               </div>
               <div className="bg-sky-50 dark:bg-sky-900/30 p-3 rounded-xl mb-6">
                   <div className="text-sm text-sky-600 dark:text-sky-400 font-bold mb-1">高安全加密分享網址</div>
                   <div className="text-sm font-mono truncate text-slate-600 dark:text-slate-400">{shareUrl}</div>
               </div>
               <button onClick={handleCopyToClipboard} className="w-full bg-indigo-500 text-white font-bold py-5 rounded-xl active:scale-95 flex items-center justify-center gap-2 shadow-md text-xl">
                   <Share2 className="w-6 h-6"/> 複製分享連結
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NurseApp({ role, nurseName, alerts, updateAlert, resolveAlert, createAlert, clearAllAlerts, patientsState, updatePatientState, createCommand, PATIENTS_LIST, systemConfig, updateSystemConfig, onLogout, settings, toggleSetting }) {
  const [toastMsg, setToastMsg] = useState(null);
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [page, setPage] = useState(1);
  const [showHandoff, setShowHandoff] = useState(null); 
  const [unlockedDetails, setUnlockedDetails] = useState({}); 
  const [errorScan, setErrorScan] = useState(null); 
  const [scanDemoTarget, setScanDemoTarget] = useState(null); 
  const [showProxyModal, setShowProxyModal] = useState(null); 
  const [showGlobalBroadcast, setShowGlobalBroadcast] = useState(false);
  const [customBroadcastText, setCustomBroadcastText] = useState('');
  const [showMarqueeConfig, setShowMarqueeConfig] = useState(false);
  const [marqueeInputText, setMarqueeInputText] = useState(systemConfig?.marqueeText || '');

  const itemsPerPage = 4;

  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
  
  useEffect(() => {
    const highAlerts = alerts.filter(a => a.priority === 'high' && a.status === 'pending');
    if (highAlerts.length > 0) {
        if (settings.vibe && navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500, 2000, 500, 1000, 500, 2000, 500, 1000, 500, 1000, 500, 2000]);
        if (settings.voice) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.8; audio.play().catch(()=>{});
        }
    }
  }, [alerts, settings.voice, settings.vibe]);

  const handleDispatch = (alertObj, targetNurse) => { updateAlert(alertObj.id, { ...alertObj, status: 'assigned', assignedTo: targetNurse }); showToast(`已指派給 ${targetNurse}`); };
  const handleClaim = (alertObj) => { updateAlert(alertObj.id, { ...alertObj, status: 'assigned', assignedTo: nurseName }); showToast(`已認領任務`); };
  const handleResolve = (alertId) => { resolveAlert(alertId); showToast(`任務已完成`); };
  const handleHandoff = (alertId, targetNurse) => { updateAlert(alertId, { assignedTo: targetNurse, status: 'assigned' }); setShowHandoff(null); };
  const handleRelease = (alertId) => { updateAlert(alertId, { assignedTo: null, status: 'pending' }); };

  const handleScanPatient = (alertId, scannedId, patientId) => {
    if (scannedId === patientId) {
        setUnlockedDetails(prev => ({ ...prev, [patientId]: true }));
        setErrorScan(null);
    } else {
        setErrorScan("⚠️ 三讀五對失敗：掃描條碼與病患不符，請立即停止給藥或處置！");
        if (settings.vibe && navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
        setTimeout(() => setErrorScan(null), 4000);
    }
  };

  const cycleLabStatus = (pId, labType) => {
    const state = getMergedState(patientsState[pId], pId);
    const curr = state.labStatus[labType]?.status || 'unprescribed';
    const nextStatus = curr === 'unprescribed' ? 'pending' : curr === 'pending' ? 'processing' : curr === 'processing' ? 'done' : curr === 'done' ? 'reported' : 'unprescribed';
    const nextText = nextStatus === 'pending' ? '待檢' : nextStatus === 'processing' ? '處理中' : nextStatus === 'done' ? '檢驗完成' : nextStatus === 'reported' ? '報告已出' : '未開立';
    
    let nextConsents = state.consents || { ct: 'disabled', admission: 'disabled' };
    if (labType === 'ct' && nextStatus === 'pending' && nextConsents.ct === 'disabled') { nextConsents.ct = 'pending'; showToast('已開立 CT，並派發同意書'); } 
    else showToast('狀態已更新');
    
    updatePatientState(pId, { labStatus: { ...state.labStatus, [labType]: { status: nextStatus, text: nextText, eta: nextStatus === 'done' || nextStatus === 'reported' ? '-' : '30分' } }, consents: nextConsents });
  };

  const cancelLabStatus = (pId, labType) => {
    const state = getMergedState(patientsState[pId], pId);
    updatePatientState(pId, { labStatus: { ...state.labStatus, [labType]: { status: 'unprescribed', text: '未開立', eta: '-' } } });
    showToast('已取消該項檢查');
  };

  const toggleReminder = (pId, rId) => {
    const state = getMergedState(patientsState[pId], pId);
    const currentReminders = state.reminders || [];
    const newReminders = currentReminders.includes(rId) ? currentReminders.filter(id => id !== rId) : [...currentReminders, rId];
    updatePatientState(pId, { reminders: newReminders });
    showToast(currentReminders.includes(rId) ? '已取消護理指示' : '已發送護理指示');
  };

  const toggleConsent = (pId, type) => {
    const state = getMergedState(patientsState[pId], pId);
    const current = state.consents[type] || 'disabled';
    const next = current === 'disabled' ? 'pending' : current === 'pending' ? 'signed' : 'disabled';
    updatePatientState(pId, { consents: { ...state.consents, [type]: next }});
    showToast(`同意書狀態已切換為：${next === 'pending' ? '待簽署' : next === 'signed' ? '已簽署' : '未開立'}`);
  };

  const handleDischarge = (pId) => { 
    updatePatientState(pId, { tokenExpired: true, currentStep: 4, currentStatus: '已離院' }); 
    alerts.filter(a => a.patientId === pId).forEach(a => resolveAlert(a.id));
    showToast('病患已離院結案，相關任務與連結已註銷'); 
  };

  const handleReadmit = (pId) => {
    const defaultPatient = PATIENTS_LIST.find(p => p.id === pId);
    updatePatientState(pId, { tokenExpired: false, currentStep: 1, currentStatus: '等候醫師看診/開單', billingPaidAt: null, waitingCount: defaultPatient ? defaultPatient.initialWaitingCount : 12 });
    showToast('已撤銷離院！病患可重新登入測試。');
  };

  const handleMarkPaid = (pId) => {
    updatePatientState(pId, { billingPaidAt: Date.now(), currentStatus: '已繳費 (預計30分後自動結案)' });
    showToast('已觸發繳費成功，病患端啟動 30 分鐘自動離院倒數 (模擬 RFID 掃描事件)');
  };

  const handleMultiBedLinkage = () => {
    const testPatients = PATIENTS_LIST.slice(0, 10);
    const alertTemplates = [
        { type: 'ivPain', message: '漏血/會痛', priority: 'high' },
        { type: 'toilet', message: '已暫離前往洗手間', priority: 'low' },
        { type: 'ivEmpty', message: '點滴不滴/沒了', priority: 'medium' },
        { type: 'other', message: '其他需求', priority: 'low' },
        { type: 'sos', message: '🚨病患發出緊急求救🚨', priority: 'high' }
    ];
    testPatients.forEach((patient, idx) => {
        const template = alertTemplates[idx % alertTemplates.length];
        createAlert({ patientId: patient.id, type: template.type, message: template.message, priority: template.priority });
    });
    showToast('已啟動大量呼叫：模擬產生 10 筆測試任務');
  };

  const handleSendGlobalBroadcast = () => {
    if (!customBroadcastText.trim()) return;
    createCommand({ patientId: 'GLOBAL', action: 'custom_emergency', message: customBroadcastText });
    
    if (customBroadcastText.includes('時間將延長') || customBroadcastText.includes('延長') || customBroadcastText.includes('急救中')) {
        PATIENTS_LIST.forEach(p => {
            const st = getMergedState(patientsState[p.id], p.id);
            updatePatientState(p.id, { waitingCount: st.waitingCount + 5 }); 
        });
    }

    setShowGlobalBroadcast(false);
    setCustomBroadcastText('');
    showToast('全區緊急廣播已送出！');
  };

  const handleUpdateMarquee = () => {
    updateSystemConfig({ marqueeText: marqueeInputText });
    setShowMarqueeConfig(false);
    showToast('全區衛教跑馬燈已更新！');
  };

  const handleResetAllPatients = () => {
      PATIENTS_LIST.forEach(p => {
          updatePatientState(p.id, {
              reminders: [],
              labStatus: { 
                 blood: { status: 'unprescribed', text: '未開立', eta: '-' }, urine: { status: 'unprescribed', text: '未開立', eta: '-' }, 
                 ecg: { status: 'unprescribed', text: '未開立', eta: '-' }, xray: { status: 'unprescribed', text: '未開立', eta: '-' }, 
                 us: { status: 'unprescribed', text: '未開立', eta: '-' }, ct: { status: 'unprescribed', text: '未開立', eta: '-' }, 
                 mri: { status: 'unprescribed', text: '未開立', eta: '-' }, other: { status: 'unprescribed', text: '未開立', eta: '-' }
              },
              consents: { ct: 'disabled', admission: 'disabled' },
              sosEnabled: false
          });
      });
      showToast('已一鍵清除所有病患的檢驗與護理狀態');
  };

  const getListForZone = (z) => PATIENTS_LIST.filter(p => {
    const st = getMergedState(patientsState[p.id], p.id);
    if (statusFilter === 'discharged') {
       if (!st.tokenExpired) return false;
       if (z !== 'all' && p.zone !== z) return false;
       return true;
    }
    if (st.tokenExpired) return false;
    if (z !== 'all' && p.zone !== z) return false;
    if (statusFilter === 'calling' && !alerts.some(a => a.patientId === p.id)) return false;
    return true;
  });

  const filteredList = getListForZone(zoneFilter).filter(p => {
     if (!searchQuery.trim()) return true;
     const q = searchQuery.toLowerCase();
     return p.id.toLowerCase().includes(q) || p.bed.includes(q) || p.name.includes(q) || p.fullName.includes(q);
  });
  
  const pagedList = filteredList.slice((page-1)*itemsPerPage, page*itemsPerPage);

  return (
    <div className="flex flex-col flex-1 h-screen relative">
      {errorScan && (
          <div className="fixed inset-0 z-[10000] bg-rose-600 flex flex-col items-center justify-center p-10 text-white text-center animate-pulse">
              <AlertTriangle className="w-32 h-32 mb-6" /><h2 className="text-5xl font-black mb-4">嚴重核對錯誤</h2><p className="text-3xl font-bold">{errorScan}</p>
          </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-800 text-white px-5 py-3 rounded-lg shadow-xl animate-[fadeIn_0.3s_ease-out] text-lg">
          {toastMsg}
        </div>
      )}

      <header className="bg-indigo-50 dark:bg-slate-800 border-b p-5 flex flex-col shrink-0 gap-3">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
               <ShieldAlert className="w-10 h-10 text-indigo-600" />
               <div><h1 className="font-bold text-xl">{role==='station'?'護理站主控台':'行動護理機'}</h1><p className="text-sm opacity-60">護理師：{nurseName}</p></div>
            </div>
            <div className="flex items-center gap-2">
               <HeaderSettings settings={settings} toggleSetting={toggleSetting} onLogout={onLogout} />
            </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
           {role === 'station' && (
              <button onClick={() => setShowGlobalBroadcast(true)} className="shrink-0 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(234,88,12,0.3)] active:scale-95 transition-all"><Megaphone className="w-5 h-5"/> 緊急廣播</button>
           )}
           <button onClick={handleMultiBedLinkage} className="shrink-0 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(79,70,229,0.3)] active:scale-95 transition-all"><Users className="w-5 h-5"/> 大量呼叫 (壓力測試)</button>
           {role === 'station' && (
              <button onClick={() => { setMarqueeInputText(systemConfig?.marqueeText || ''); setShowMarqueeConfig(true); }} className="shrink-0 bg-gradient-to-r from-sky-600 to-blue-500 hover:from-sky-500 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(14,165,233,0.3)] active:scale-95 transition-all"><Info className="w-5 h-5"/> 設定衛教跑馬燈</button>
           )}
           <button onClick={() => { clearAllAlerts(); showToast('已一鍵清除所有任務'); }} className="shrink-0 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(100,116,139,0.3)] active:scale-95 transition-all"><Trash2 className="w-5 h-5"/> 任務全清 (測試)</button>
           {role === 'station' && (
              <button onClick={handleResetAllPatients} className="shrink-0 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 shadow-[0_4px_15px_rgba(100,116,139,0.3)] active:scale-95 transition-all"><RefreshCw className="w-5 h-5"/> 狀態全清 (測試)</button>
           )}
        </div>
      </header>

      <div className={`flex flex-1 overflow-hidden ${role==='station'?'flex-row':'flex-col'}`}>
        {role === 'station' && (
          <main className="flex-[2.5] flex flex-col overflow-hidden border-r border-slate-200 bg-slate-50/50">
             <div className="p-3 bg-white dark:bg-slate-800 border-b flex flex-col gap-3">
                <div className="flex justify-between items-center gap-2">
                   <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg overflow-x-auto hide-scrollbar">
                      {['all','看診區','兒科區','留觀區','重症區'].map(z => {
                         const count = getListForZone(z).length;
                         return (
                            <button key={z} onClick={()=>{setZoneFilter(z); setPage(1);}} className={`px-4 py-1.5 rounded text-sm font-bold whitespace-nowrap shrink-0 ${zoneFilter===z?'bg-white dark:bg-slate-700 shadow text-indigo-600':'text-slate-400'}`}>
                               {z==='all'?'全區':z} <span className="ml-1 opacity-70">({count})</span>
                            </button>
                         )
                      })}
                   </div>
                   <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-lg shrink-0">
                      {['all', 'calling', 'discharged'].map(s => {
                         const labels = { all: '全部', calling: '🔔 呼叫中', discharged: '🔒 已結案' };
                         return (
                            <button key={s} onClick={()=>{setStatusFilter(s); setPage(1);}} className={`px-4 py-1.5 rounded text-sm font-bold ${statusFilter===s?'bg-white dark:bg-slate-700 shadow text-indigo-600':'text-slate-400'}`}>
                               {labels[s]}
                            </button>
                         )
                      })}
                   </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                   <Search className="w-5 h-5 text-slate-400 shrink-0" />
                   <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} 
                      placeholder="輸入病歷號、床號或姓名搜尋病患... (例如: 03)" 
                      className="bg-transparent outline-none w-full text-base font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400" 
                   />
                   {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-5 h-5 text-slate-400 hover:text-rose-500"/></button>}
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredList.length === 0 ? (
                   <div className="col-span-1 lg:col-span-2 flex flex-col items-center justify-center py-20 text-slate-400">
                      <Search className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-xl font-bold">找不到符合條件的病患</p>
                   </div>
                ) : pagedList.map(p => {
                   const st = getMergedState(patientsState[p.id], p.id);
                   const isCalling = alerts.filter(a => a.patientId === p.id);
                   const triageObj = getTriageStyle(p.triageLevel || 3);
                   
                   return (
                     <div key={p.id} className={`console-patient-card bg-white dark:bg-slate-800 p-5 rounded-2xl border ${isCalling.length>0?'border-rose-400 shadow-rose-100 animate-pulse':'border-slate-200 dark:border-slate-700'} relative flex flex-col`}>
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center font-black text-2xl shadow-inner">{p.bed}</div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start mb-1">
                                 <div className="flex items-center gap-2">
                                     <h3 className="font-black text-xl">{p.name}</h3>
                                     <span className={`text-xs font-bold px-2 py-1 rounded border ${triageObj.bg} ${triageObj.color} ${triageObj.border}`}>檢傷 {p.triageLevel} 級</span>
                                 </div>
                                 <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">{p.zone}</span>
                              </div>
                              <p className="text-sm text-sky-600 dark:text-sky-400 font-bold mb-1">{st.currentStatus}</p>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                                 <span>📍 {st.location || '急診大廳'}</span>
                                 <span>⏳ 前方等待: {st.waitingCount}人</span>
                              </div>
                           </div>
                        </div>

                        {st.tokenExpired ? (
                           <div className="flex flex-col items-center justify-center py-8 gap-4 mt-auto border-t border-slate-100 dark:border-slate-700">
                              <div className="text-slate-400 font-bold text-base">此病患已結案離院</div>
                              <button onClick={() => handleReadmit(p.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-4 rounded-xl font-bold shadow-md w-full active:scale-95 transition-transform text-lg">
                                 🔄 撤銷離院 (測試用重新收治)
                              </button>
                           </div>
                        ) : (
                           <>
                              <div className="flex gap-2 mb-3 flex-wrap border-b border-slate-100 dark:border-slate-700 pb-3">
                                 <button onClick={()=>createCommand({patientId: p.id, action: 'urgent_call'})} className="px-3 py-1.5 bg-rose-100 text-rose-700 rounded text-xs font-bold border border-rose-200 hover:bg-rose-200 active:scale-95 transition-all">🔊 強制叫號</button>
                                 <button onClick={()=>updatePatientState(p.id, {sosEnabled: !st.sosEnabled})} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${st.sosEnabled ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{st.sosEnabled ? '已准SOS' : '開放SOS'}</button>
                                 <button onClick={()=>setShowProxyModal(p.id)} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded text-xs font-bold border border-purple-200 hover:bg-purple-200 active:scale-95 transition-all">👨‍⚖️ 授權代簽</button>
                                 <button onClick={()=>toggleConsent(p.id, 'ct')} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${st.consents.ct==='pending'?'bg-amber-50 text-amber-600 border-amber-200':st.consents.ct==='signed'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-slate-50 text-slate-400 border-slate-200'}`}>CT同意</button>
                                 <button onClick={()=>toggleConsent(p.id, 'admission')} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${st.consents.admission==='pending'?'bg-amber-50 text-amber-600 border-amber-200':st.consents.admission==='signed'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-slate-50 text-slate-400 border-slate-200'}`}>住院同意</button>
                              </div>
                              
                              <div className="text-sm font-bold text-slate-500 mb-2">檢驗開立與排單控制</div>
                              <div className="flex flex-wrap gap-2 mb-3">
                                 {LAB_TYPES.map(l => {
                                    const lState = st.labStatus[l.id]?.status || 'unprescribed';
                                    const label = lState==='reported'?'報告已出':lState==='done'?'完成':lState==='processing'?'處理':lState==='pending'?'待檢':'未開';
                                    return (
                                      <div key={l.id} className="flex items-center">
                                         <button onClick={() => cycleLabStatus(p.id, l.id)} className={`px-3 py-1.5 ${lState!=='unprescribed' ? 'rounded-l' : 'rounded'} text-xs font-bold border transition-colors ${lState!=='unprescribed' ? LAB_TYPES.find(x=>x.id===l.id).activeCls : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-slate-50'}`}>{l.label} [{label}]</button>
                                         {lState !== 'unprescribed' && (
                                            <button onClick={() => cancelLabStatus(p.id, l.id)} className={`px-2 py-1.5 rounded-r text-xs font-bold border-y border-r transition-colors ${LAB_TYPES.find(x=>x.id===l.id).activeCls} hover:brightness-90 flex items-center justify-center`} title="取消檢查">
                                               <X className="w-3 h-3" />
                                            </button>
                                         )}
                                      </div>
                                    );
                                 })}
                              </div>

                              <div className="text-sm font-bold text-slate-500 mb-2 mt-3">語音護理指示廣播</div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  {REMINDER_TYPES.map(r => {
                                      const isActive = (st.reminders || []).includes(r.id);
                                      return <button key={r.id} onClick={() => toggleReminder(p.id, r.id)} className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors ${isActive ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>{r.icon} {r.label}</button>
                                  })}
                              </div>

                              <div className="mt-auto grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                                 <button onClick={()=>createCommand({patientId: p.id, action: 'nurse'})} className="text-sm font-bold py-4 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 text-indigo-700 rounded-[1rem]"><PhoneCall className="w-5 h-5 inline mr-2"/>導航回站</button>
                                 <button onClick={()=>createCommand({patientId: p.id, action: 'xray'})} className="text-sm font-bold py-4 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 text-cyan-700 rounded-[1rem]"><MonitorSmartphone className="w-5 h-5 inline mr-2"/>去X光</button>
                              </div>
                              <div className="mt-3">
                                 <SwipeToConfirm text="滑動以離院" onConfirm={() => handleDischarge(p.id)} bgClass="bg-rose-50 border border-rose-200" activeBgClass="bg-rose-500" textClass="text-rose-600" />
                              </div>
                              <button onClick={()=>handleMarkPaid(p.id)} disabled={st.billingPaidAt} className={`mt-2 w-full py-3 text-sm font-bold rounded-[1rem] border transition-all flex items-center justify-center gap-2 ${st.billingPaidAt ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-not-allowed' : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'}`}>
                                 <CreditCard className="w-5 h-5"/> {st.billingPaidAt ? '已觸發繳費，30分鐘自動結案倒數中' : '💳 批價模擬測試 (模擬 RFID 觸發自動離院倒數)'}
                              </button>
                           </>
                        )}
                     </div>
                   );
                })}
             </div>

             <div className="p-4 border-t bg-white dark:bg-slate-800 flex justify-center items-center gap-5 text-sm font-bold">
                <button disabled={page===1} onClick={()=>setPage(page-1)} className="p-2 rounded bg-slate-100 dark:bg-slate-700"><ChevronLeft className="w-5 h-5"/></button>
                <span>第 {page} 頁 / 共 {Math.ceil(filteredList.length/itemsPerPage) || 1} 頁</span>
                <button disabled={page*itemsPerPage >= filteredList.length} onClick={()=>setPage(page+1)} className="p-2 rounded bg-slate-100 dark:bg-slate-700"><ChevronLeft className="w-5 h-5 rotate-180"/></button>
             </div>
          </main>
        )}

        <aside className={`flex-1 flex flex-col bg-slate-100 dark:bg-slate-900 p-5 overflow-y-auto ${role === 'nurse_mobile' ? 'w-full' : ''}`}>
          <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-bold text-rose-500 flex items-center gap-2"><Bell className="w-5 h-5"/> 任務佇列 ({alerts.length})</h2></div>
          {alerts.length === 0 ? <div className="text-center py-12 opacity-30 text-lg">目前無任務</div> : alerts.map(a => {
             const pat = PATIENTS_LIST.find(p => p.id === a.patientId) || { name: '未知', bed: '?' };
             const isMe = a.assignedTo === nurseName;
             const isDetailsUnlocked = unlockedDetails[a.patientId] || a.patientId === 'GLOBAL';

             return (
               <div key={a.id} className={`bg-white dark:bg-slate-800 p-6 rounded-3xl mb-5 shadow-md border-l-8 ${a.priority==='high'?'border-rose-500':'border-sky-500'} animate-[fadeIn_0.2s_ease-out]`}>
                  <div className="flex justify-between items-start mb-3">
                     <div>
                        <div className="text-sm text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
                            {a.patientId === 'GLOBAL' ? <AlertOctagon className="w-4 h-4 text-rose-500"/> : <MapPin className="w-4 h-4"/>} 
                            {a.patientId === 'GLOBAL' ? '全區廣播' : `Bed ${pat.bed}`}
                        </div>
                        <div className="text-2xl font-black flex items-center gap-2">
                            {isDetailsUnlocked && a.patientId !== 'GLOBAL' ? `${pat.fullName} (${pat.dob})` : pat.name}
                            {isDetailsUnlocked && a.patientId !== 'GLOBAL' && <UserCheck className="w-6 h-6 text-emerald-500" />}
                        </div>
                     </div>
                     <span className={`text-xs font-bold px-3 py-1 rounded-full ${a.status==='assigned'?'bg-indigo-500 text-white':'bg-slate-100 dark:bg-slate-700'}`}>{a.status==='assigned' ? (isMe ? '我處理中' : `${a.assignedTo}處理`) : '待認領'}</span>
                  </div>
                  <p className={`font-black text-xl mb-6 ${a.priority==='high'?'text-rose-600':'text-sky-600'}`}>{a.message}</p>
                  
                  {role === 'station' && a.status === 'pending' && (
                     <div className="flex gap-2 flex-wrap">
                        {STAFF_LIST.map(n => <button key={n.empId} onClick={() => handleDispatch(a, n.name)} className="bg-slate-100 hover:bg-indigo-50 text-xs font-bold px-4 py-2 rounded-lg transition-colors">{n.name.slice(0,1)}護理師</button>)}
                     </div>
                  )}

                  {role === 'nurse_mobile' && (
                     <div className="space-y-4">
                        {a.status === 'pending' ? (
                           <button onClick={()=>handleClaim(a)} className="w-full bg-sky-600 text-white font-bold py-5 rounded-2xl shadow-lg active:scale-95 text-xl">主責護師處理中</button>
                        ) : isMe ? (
                           <>
                              {a.patientId !== 'GLOBAL' && (
                                 <div className="grid grid-cols-2 gap-4">
                                    <button onClick={()=>setScanDemoTarget(scanDemoTarget === a.id ? null : a.id)} className="flex-1 flex flex-col items-center justify-center p-5 border-2 border-dashed border-indigo-300 dark:border-indigo-600 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 active:bg-indigo-100">
                                       <ScanLine className="w-10 h-10 mb-2" />
                                       <span className="text-base font-bold">掃描核對</span>
                                    </button>
                                    <button onClick={()=>setShowHandoff(a.id)} className="flex-1 flex flex-col items-center justify-center p-5 border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 active:bg-amber-100">
                                       <RefreshCw className="w-10 h-10 mb-2" />
                                       <span className="text-base font-bold">一鍵交班</span>
                                    </button>
                                 </div>
                              )}
                              
                              {scanDemoTarget === a.id && !isDetailsUnlocked && a.patientId !== 'GLOBAL' && (
                                 <div className="flex gap-3 animate-[fadeIn_0.2s_ease-out]">
                                    <button onClick={()=>{handleScanPatient(a.id, pat.id, pat.id); setScanDemoTarget(null);}} className="flex-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 py-4 rounded-2xl font-bold border border-emerald-300 hover:bg-emerald-100 transition-colors text-lg">✅ 掃描正確</button>
                                    <button onClick={()=>{handleScanPatient(a.id, 'WRONG_ID', pat.id); setScanDemoTarget(null);}} className="flex-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 py-4 rounded-2xl font-bold border border-rose-300 hover:bg-rose-100 transition-colors text-lg">❌ 掃描錯誤</button>
                                 </div>
                              )}

                              {isDetailsUnlocked ? (
                                 <SwipeToConfirm text="滑動以銷案" onConfirm={() => resolveAlert(a.id)} bgClass="bg-emerald-100 border border-emerald-200" activeBgClass="bg-emerald-500" textClass="text-emerald-700" icon={<CheckCircle2 className="w-6 h-6 text-emerald-500"/>}/>
                              ) : (
                                 <div className="w-full bg-slate-200 dark:bg-slate-700 text-slate-400 text-center py-4 rounded-[1.5rem] font-bold text-sm">請先掃描核對</div>
                              )}
                              
                              <div className="mt-3">
                                 <SwipeToConfirm text="滑動以釋放任務" onConfirm={() => handleRelease(a.id)} bgClass="bg-slate-200 dark:bg-slate-700" activeBgClass="bg-slate-500" textClass="text-slate-500" />
                              </div>
                           </>
                        ) : null}
                     </div>
                  )}
               </div>
             );
          })}
        </aside>
      </div>

      {showHandoff && (
          <div className="fixed inset-0 z-[5000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6">
             <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-slate-200 dark:border-slate-700">
                <button onClick={()=>setShowHandoff(null)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-700 rounded-full"><X className="w-6 h-6"/></button>
                <h3 className="text-2xl font-black mb-3 flex items-center gap-3"><RefreshCw className="w-6 h-6 text-amber-500"/> 交班任務給...</h3>
                <p className="text-sm text-slate-400 mb-8">選擇接手任務的人員，系統將自動移轉權限</p>
                <div className="grid grid-cols-1 gap-4">
                   {STAFF_LIST.filter(s => s.name !== nurseName).map(s => (
                      <button key={s.empId} onClick={()=>handleHandoff(showHandoff, s.name)} className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-5 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 active:scale-95 transition-all">
                         <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center"><UserCircle className="w-7 h-7"/></div>
                         <span className="font-bold text-xl">{s.name}</span>
                      </button>
                   ))}
                </div>
             </div>
          </div>
      )}

      {showProxyModal && (
          <div className="fixed inset-0 z-[6000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] w-full max-w-md text-center shadow-2xl relative">
               <button onClick={() => setShowProxyModal(null)} className="absolute top-6 right-6"><X className="w-8 h-8 text-slate-400 hover:text-slate-700"/></button>
               <h3 className="text-3xl font-black mb-3 text-purple-600 dark:text-purple-400 flex items-center justify-center gap-2"><PenTool className="w-8 h-8"/> 家屬代簽授權</h3>
               <p className="text-slate-500 text-base mb-8">請代理人掃描專屬條碼。進入前仍需核對病患身分證後四碼。</p>
               <div className="bg-white p-3 rounded-2xl mb-8 aspect-square w-56 border-2 border-purple-200 mx-auto flex items-center justify-center min-h-[220px]">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href.split('?')[0].split('#')[0] : 'https://er-omo.demo')}?token=${PATIENTS_LIST.find(p=>p.id===showProxyModal)?.token}%26proxy=true`} alt="Proxy QR Code" className="w-full h-full object-contain" />
               </div>
               <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-xl mb-6">
                   <div className="text-sm text-purple-600 dark:text-purple-400 font-bold mb-1.5">代理人授權專屬網址</div>
                   <div className="text-xs font-mono truncate text-slate-600 dark:text-slate-400">...?token=...&proxy=true</div>
               </div>
            </div>
          </div>
      )}

      {showGlobalBroadcast && (
          <div className="fixed inset-0 z-[6000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative border-2 border-orange-500">
               <button onClick={() => setShowGlobalBroadcast(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-8 h-8"/></button>
               <h3 className="text-3xl font-black mb-3 text-orange-600 flex items-center gap-3"><Megaphone className="w-8 h-8"/> 發送緊急廣播</h3>
               <p className="text-slate-500 text-base mb-6 font-bold">此訊息將<span className="text-rose-500">強制突破靜音設定</span>，在全區病患手機以最高音量播報並全螢幕閃爍。請謹慎使用。</p>
               
               <div className="flex flex-col gap-2 mb-6">
                  <span className="text-sm font-bold text-slate-400">快速套版：</span>
                  <div className="flex flex-wrap gap-2">
                     <button onClick={() => setCustomBroadcastText('急診內科診間目前發生持刀攻擊事件請各位立即遠離現場,並遵循醫護人員指示以確保安全。')} className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors">暴力事件</button>
                     <button onClick={() => setCustomBroadcastText('本院急診已啟動大量傷患應變。看診與檢查時間將延長，請病友與家屬配合並諒解。')} className="bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors">大量傷患</button>
                     <button onClick={() => setCustomBroadcastText('急診室有緊急病人急救中，看診、檢查時間將延長，請病友與家屬配合並諒解。')} className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">一級急救</button>
                  </div>
               </div>

               <textarea 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 outline-none focus:border-orange-500 resize-none h-40 text-xl font-bold" 
                  placeholder="請輸入警報內容..."
                  value={customBroadcastText}
                  onChange={(e) => setCustomBroadcastText(e.target.value)}
               ></textarea>
               
               <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowGlobalBroadcast(false)} className="flex-1 py-5 font-bold rounded-2xl bg-slate-100 text-slate-500 text-xl">取消</button>
                  <button onClick={handleSendGlobalBroadcast} disabled={!customBroadcastText.trim()} className={`flex-[2] py-5 font-black rounded-2xl text-white transition-all shadow-lg text-xl ${customBroadcastText.trim() ? 'bg-orange-600 hover:bg-orange-700 active:scale-95' : 'bg-slate-300 cursor-not-allowed'}`}>立即發送推播</button>
               </div>
            </div>
          </div>
      )}

      {showMarqueeConfig && (
          <div className="fixed inset-0 z-[6000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl relative border-2 border-sky-400">
               <button onClick={() => setShowMarqueeConfig(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-8 h-8"/></button>
               <h3 className="text-3xl font-black mb-3 text-sky-600 flex items-center gap-3"><Info className="w-8 h-8"/> 設定衛教跑馬燈</h3>
               <p className="text-slate-500 text-base mb-8 font-bold">更改的文字將即時顯示於全區病患的手機頂端。</p>
               
               <div className="flex flex-col gap-2 mb-6">
                  <span className="text-sm font-bold text-slate-400">快速套版：</span>
                  <div className="flex flex-wrap gap-2">
                     <button onClick={() => setMarqueeInputText('目前急診留觀病患人數較多若您為輕症患者或希望轉至住家附近之醫療院所，請洽護理站醫護人員,我們將協助您辦理轉院事宜。')} className="bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-100 transition-colors">滿床轉院宣導</button>
                     <button onClick={() => setMarqueeInputText('國內新增腦脊髓膜炎確定病例,籲請民眾注意呼吸道衛生,出現疑似症狀應儘速就醫')} className="bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-100 transition-colors">腦脊髓膜炎</button>
                     <button onClick={() => setMarqueeInputText('腸病毒好發季,籲請民眾落實肥皂勤洗手及環境清消並留意嬰幼兒重症前兆病徵。')} className="bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 rounded-lg text-xs font-bold hover:bg-sky-100 transition-colors">腸病毒</button>
                  </div>
               </div>

               <textarea 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 outline-none focus:border-sky-500 resize-none h-40 text-lg font-bold" 
                  placeholder="請輸入衛教或宣導文字..."
                  value={marqueeInputText}
                  onChange={(e) => setMarqueeInputText(e.target.value)}
               ></textarea>
               
               <div className="flex gap-4 mt-8">
                  <button onClick={() => setShowMarqueeConfig(false)} className="flex-1 py-5 font-bold rounded-2xl bg-slate-100 text-slate-500 text-xl">取消</button>
                  <button onClick={handleUpdateMarquee} className="flex-[2] py-5 font-black rounded-2xl text-white transition-all shadow-lg text-xl bg-sky-500 hover:bg-sky-600 active:scale-95">更新全區跑馬燈</button>
               </div>
            </div>
          </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-xl max-w-lg w-full text-center border-2 border-rose-100">
             <AlertTriangle className="w-24 h-24 text-rose-500 mx-auto mb-6 animate-pulse" />
             <h1 className="text-3xl font-black text-slate-800 mb-4">系統安全防護已啟動</h1>
             <p className="text-rose-600 font-bold mb-4 bg-rose-50 p-4 rounded-xl break-words text-lg">{String(this.state.errorMsg)}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}