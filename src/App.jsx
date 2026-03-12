import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// 1. Firebase Initialization & Config
// ==========================================
const userFirebaseConfig = {
  apiKey: "AIzaSyAdFJeGDJI9IxRZ9_k2ssOP9Ns3DL6Nhlg",
  authDomain: "deer-7327a.firebaseapp.com",
  projectId: "deer-7327a",
  storageBucket: "deer-7327a.firebasestorage.app",
  messagingSenderId: "772101073013",
  appId: "1:772101073013:web:098e979cb896d2f633b03c",
  measurementId: "G-CE68YLW648"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'deer-app';

// ==========================================
// 2. Mock Data (Fallback)
// ==========================================
const MOCK_DATA = {
  deerProfiles: [],
  feedingLogs: [],
  issueLogs: []
};

// ==========================================
// 3. Utility: 動態載入 Script
// ==========================================
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// ==========================================
// 4. Main App Component
// ==========================================
export default function App() {
  const [stylesLoaded, setStylesLoaded] = useState(false);
  const [user, setUser] = useState(null);
  
  // 利用 localStorage 記住登入狀態，避免重新整理後登出
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('sambar_user') || null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 行動版選單狀態
  const [flashes, setFlashes] = useState([]);
  
  // App State Data (Synchronized with Firebase)
  const [deerList, setDeerList] = useState(MOCK_DATA.deerProfiles);
  const [feedLogs, setFeedLogs] = useState(MOCK_DATA.feedingLogs);
  const [issueLogs, setIssueLogs] = useState(MOCK_DATA.issueLogs);

  // -- 載入 Tailwind CSS --
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const existingScript = document.getElementById('tailwind-script');
      if (existingScript) {
        setStylesLoaded(true);
      } else {
        const twScript = document.createElement('script');
        twScript.id = 'tailwind-script';
        twScript.src = 'https://cdn.tailwindcss.com';
        twScript.onload = () => setStylesLoaded(true);
        document.head.appendChild(twScript);
      }
    }
  }, []);

  // -- Firebase Auth --
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("登入失敗，請確認 Firebase 是否已啟用「匿名登入」", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // -- Firebase Data Fetching --
  useEffect(() => {
    if (!user) return;

    const deerRef = collection(db, 'artifacts', appId, 'public', 'data', 'deerProfiles');
    const unsubDeer = onSnapshot(deerRef, (snapshot) => {
       const data = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
       setDeerList(data);
    }, (err) => console.error("Deer fetch error:", err));

    const feedRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedingLogs');
    const unsubFeed = onSnapshot(feedRef, (snapshot) => {
       const data = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
       setFeedLogs(data.sort((a,b) => b.feed_time.localeCompare(a.feed_time)));
    }, (err) => console.error("Feed fetch error:", err));

    const issueRef = collection(db, 'artifacts', appId, 'public', 'data', 'issueLogs');
    const unsubIssue = onSnapshot(issueRef, (snapshot) => {
       const data = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
       setIssueLogs(data.sort((a,b) => b.date.localeCompare(a.date)));
    }, (err) => console.error("Issue fetch error:", err));

    return () => { unsubDeer(); unsubFeed(); unsubIssue(); };
  }, [user]);

  // -- Data Modification Handlers --
  const requireAuth = () => {
    if (!user) {
      showFlash('操作被拒絕：連線異常，請至 Firebase 啟用「匿名登入」', 'error');
      return false;
    }
    return true;
  };

  const handleAddDeer = async (deerData) => {
    if(!requireAuth()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'deerProfiles'), deerData);
      showFlash(`鹿隻 ${deerData.id} 建立成功！`, 'success');
    } catch (e) { showFlash(`建立失敗: ${e.message}`, 'error'); }
  };

  const handleUpdateDeer = async (firebaseId, deerData) => {
    if(!requireAuth()) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'deerProfiles', firebaseId), deerData);
      showFlash(`鹿隻資料已成功更新！`, 'success');
    } catch (e) { showFlash(`更新失敗: ${e.message}`, 'error'); }
  };

  const handleDeleteDeer = async (firebaseId) => {
    if(!requireAuth()) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'deerProfiles', firebaseId));
      showFlash(`鹿隻已成功刪除！`, 'info');
    } catch (e) { showFlash(`刪除失敗: ${e.message}`, 'error'); }
  };

  const handleAddFeedLog = async (logData) => {
    if(!requireAuth()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'feedingLogs'), logData);
      showFlash('✅ 飼養紀錄已儲存', 'success');
    } catch (e) { showFlash(`儲存失敗: ${e.message}`, 'error'); }
  };

  const handleDeleteFeedLog = async (firebaseId) => {
    if(!requireAuth()) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'feedingLogs', firebaseId));
      showFlash(`紀錄已成功刪除！`, 'info');
    } catch (e) { showFlash(`刪除失敗: ${e.message}`, 'error'); }
  };

  const handleAddIssueLog = async (logData) => {
    if(!requireAuth()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'issueLogs'), logData);
      showFlash('✅ 異常回報已送出', 'success');
    } catch (e) { showFlash(`回報失敗: ${e.message}`, 'error'); }
  };

  const handleUpdateIssueStatus = async (firebaseId, newStatus) => {
    if(!requireAuth()) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'issueLogs', firebaseId), { status: newStatus });
      showFlash('✅ 問題狀態已更新', 'success');
    } catch (e) { showFlash(`狀態更新失敗: ${e.message}`, 'error'); }
  };

  const handleDeleteIssueLog = async (firebaseId) => {
    if(!requireAuth()) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'issueLogs', firebaseId));
      showFlash(`回報紀錄已成功刪除！`, 'info');
    } catch (e) { showFlash(`刪除失敗: ${e.message}`, 'error'); }
  };

  // -- UI Helpers --
  const showFlash = (message, type = 'success') => {
    const id = Date.now();
    setFlashes(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setFlashes(prev => prev.filter(f => f.id !== id));
    }, 4000);
  };

  const handleLogin = (username) => {
    setCurrentUser(username);
    localStorage.setItem('sambar_user', username); // 記住登入狀態
    setCurrentPage('dashboard');
    showFlash(`歡迎回來，${username}！`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sambar_user'); // 清除登入狀態
    setCurrentPage('login');
    showFlash('已成功登出', 'info');
  };

  const handleNavClick = (page) => {
    setCurrentPage(page);
    setIsMobileMenuOpen(false); // 切換頁面後自動關閉手機選單
  };

  // 在 Tailwind 樣式載入前，顯示純 CSS 的加載畫面遮罩
  if (!stylesLoaded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'linear-gradient(135deg, #fdfbf7 0%, #e8f5e9 50%, #e3f2fd 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '5rem', animation: 'bounce 1s infinite alternate' }}>🦌</div>
        <h2 style={{ color: '#2f855a', marginTop: '20px', fontWeight: 'bold', letterSpacing: '2px' }}>牧場系統載入中...</h2>
        <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-20px); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <GlobalStyles />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen font-sans text-gray-800" style={{ background: 'var(--bg-gradient)' }}>
        {/* Navbar */}
        <nav className="sticky top-0 z-50 flex items-center justify-between h-[70px] px-4 md:px-8 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
          <div className="flex items-center gap-2 text-xl md:text-2xl font-bold text-[#2f855a] tracking-wide cursor-pointer" onClick={() => handleNavClick('dashboard')}>
            🦌 Sambar Deer MIS
          </div>
          
          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-gray-500 font-medium pr-4 mr-2 border-r-2 border-gray-200 text-sm">
              👋 {currentUser}
            </span>
            <NavButton active={currentPage === 'dashboard'} onClick={() => handleNavClick('dashboard')}>儀表板</NavButton>
            <NavButton active={currentPage === 'digital_twin'} onClick={() => handleNavClick('digital_twin')} className="bg-gradient-to-br from-teal-500 to-teal-400 text-white shadow-md hover:-translate-y-0.5">✨ 數位農場</NavButton>
            <NavButton active={currentPage === 'deer_profiles'} onClick={() => handleNavClick('deer_profiles')}>鹿籍履歷</NavButton>
            <NavButton active={currentPage === 'feeding'} onClick={() => handleNavClick('feeding')}>飼養管理</NavButton>
            <NavButton active={currentPage === 'growth'} onClick={() => handleNavClick('growth')}>生長紀錄</NavButton>
            <NavButton active={currentPage === 'environment'} onClick={() => handleNavClick('environment')}>環境監控</NavButton>
            <button onClick={handleLogout} className="px-5 py-2 rounded-full font-medium transition-all text-red-600 border-2 border-red-200 hover:bg-red-50 text-sm ml-2">登出</button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className="lg:hidden text-2xl text-gray-600 hover:text-[#2f855a] p-2 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </nav>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed top-[70px] left-0 w-full bg-white/95 backdrop-blur-xl shadow-lg border-b border-gray-100 p-4 flex flex-col gap-3 z-40 animate-slide-in">
            <span className="text-gray-500 font-medium text-sm border-b border-gray-100 pb-3 mb-1 text-center">
              👋 目前登入：{currentUser}
            </span>
            <MobileNavButton active={currentPage === 'dashboard'} onClick={() => handleNavClick('dashboard')}>📊 儀表板</MobileNavButton>
            <MobileNavButton active={currentPage === 'digital_twin'} onClick={() => handleNavClick('digital_twin')} className="bg-gradient-to-br from-teal-500 to-teal-400 text-white">✨ 數位農場</MobileNavButton>
            <MobileNavButton active={currentPage === 'deer_profiles'} onClick={() => handleNavClick('deer_profiles')}>📋 鹿籍履歷</MobileNavButton>
            <MobileNavButton active={currentPage === 'feeding'} onClick={() => handleNavClick('feeding')}>🌾 飼養管理</MobileNavButton>
            <MobileNavButton active={currentPage === 'growth'} onClick={() => handleNavClick('growth')}>📈 生長紀錄</MobileNavButton>
            <MobileNavButton active={currentPage === 'environment'} onClick={() => handleNavClick('environment')}>📡 環境監控</MobileNavButton>
            <button onClick={handleLogout} className="mt-2 py-3 rounded-xl font-bold transition-all text-red-600 bg-red-50 border border-red-100 text-center">登出系統</button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="max-w-[1400px] mx-auto p-4 md:p-8 animate-fade-in relative">
          {/* Flash Messages */}
          <div className="fixed top-[80px] right-4 md:right-8 z-[100] flex flex-col gap-3 pointer-events-none w-[calc(100%-2rem)] md:w-auto">
            {flashes.map(f => (
              <div key={f.id} className={`flex items-center p-4 rounded-xl shadow-lg bg-white border-l-4 font-medium animate-slide-in pointer-events-auto ${f.type === 'success' ? 'border-green-500 text-green-800' : f.type === 'error' ? 'border-red-500 text-red-800' : 'border-blue-500 text-blue-800'}`}>
                <span className="mr-3">{f.type === 'success' ? '✅' : f.type === 'error' ? '❌' : 'ℹ️'}</span>
                {f.message}
              </div>
            ))}
          </div>

          {/* Router / View Switcher */}
          {currentPage === 'dashboard' && <Dashboard deerList={deerList} issueLogs={issueLogs} onAddIssue={handleAddIssueLog} onUpdateIssueStatus={handleUpdateIssueStatus} onDeleteIssue={handleDeleteIssueLog} username={currentUser} />}
          {currentPage === 'deer_profiles' && <DeerProfiles deerList={deerList} onAdd={handleAddDeer} onUpdate={handleUpdateDeer} onDelete={handleDeleteDeer} />}
          {currentPage === 'feeding' && <Feeding feedLogs={feedLogs} onAddFeed={handleAddFeedLog} onDeleteFeed={handleDeleteFeedLog} username={currentUser} />}
          {currentPage === 'digital_twin' && <DigitalTwin deerList={deerList} setCurrentPage={handleNavClick} />}
          {currentPage === 'environment' && <Environment />}
          {currentPage === 'growth' && (
            <div className="bg-white rounded-2xl p-8 md:p-12 text-center shadow-sm border border-gray-100">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-400 mb-4">🚧 Coming Soon...</h1>
              <p className="text-gray-500">此模組正在開發中，敬請期待！</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// --- Navigation Buttons ---
function NavButton({ children, active, onClick, className = '' }) {
  return (
    <button 
      onClick={onClick}
      className={`px-5 py-2 rounded-full font-medium transition-all text-sm ${
        active 
          ? 'bg-[#2f855a] text-white shadow-lg shadow-green-600/30' 
          : 'text-gray-600 hover:bg-green-50 hover:text-[#2f855a]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function MobileNavButton({ children, active, onClick, className = '' }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-3 rounded-xl font-bold transition-all text-left ${
        active 
          ? 'bg-[#2f855a] text-white shadow-md' 
          : 'text-gray-700 bg-gray-50 hover:bg-gray-100'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// ==========================================
// Views
// ==========================================

// --- Login View ---
function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    document.getElementById('runner-container').classList.add('dash-animation');
    document.getElementById('loginWrapper').classList.add('fade-out');

    setTimeout(() => {
      onLogin(username || 'Admin');
    }, 1500);
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen p-4 md:p-8 overflow-hidden bg-gradient-to-br from-[#fdfbf7] via-[#e8f5e9] to-[#e3f2fd]">
      <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(132, 250, 176, 0.1) 0%, transparent 70%)', animation: 'rotateGradient 20s linear infinite' }}></div>
      
      <div className="absolute top-[15%] text-5xl md:text-6xl opacity-70 animate-float-cloud-1 drop-shadow-sm">☁️</div>
      <div className="absolute top-[40%] text-4xl md:text-5xl opacity-70 animate-float-cloud-2 drop-shadow-sm">☁️</div>
      <div className="absolute top-[65%] text-6xl md:text-7xl opacity-70 animate-float-cloud-3 drop-shadow-sm">☁️</div>

      <div className="absolute bottom-0 left-0 w-full h-[60px] md:h-[80px] bg-cover bg-no-repeat opacity-70 z-10" style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23e2f5e8" fill-opacity="0.6" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,224C672,245,768,267,864,250.7C960,235,1056,181,1152,165.3C1248,149,1344,171,1392,181.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>')`}}></div>

      <div id="runner-container" className="fixed top-[55%] left-[50%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[100] opacity-0 hidden">
        <div className="text-[5rem] md:text-[6rem] drop-shadow-md animate-gallop">🦌💨</div>
      </div>

      <div id="loginWrapper" className="w-full max-w-[440px] relative z-20 animate-fade-in-up">
        <div className="bg-white/95 backdrop-blur-xl rounded-[24px] md:rounded-[32px] p-8 md:p-12 text-center shadow-[0_10px_40px_rgba(139,119,101,0.08)] border-4 border-white relative transition-transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#84fab0] via-[#8fd3f4] to-[#a6c1ee] rounded-t-[20px] md:rounded-t-[28px]"></div>
          
          <div className="text-[4rem] md:text-[5rem] mb-3 inline-block animate-float-deer drop-shadow-[0_4px_12px_rgba(132,250,176,0.3)] transition-transform hover:scale-110 hover:rotate-6">🦌</div>
          <div className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-[#5d576b] to-[#7d778b] bg-clip-text text-transparent mb-1 tracking-wide">Deer MIS</div>
          <div className="text-gray-400 text-sm md:text-base mb-8 md:mb-10 font-medium">台灣水鹿牧場管理系統</div>

          <form onSubmit={handleSubmit} className="text-left space-y-5 md:space-y-6">
            <div>
              <label className="block text-[#7d778b] mb-2 text-sm font-semibold pl-3 transition-colors">帳號</label>
              <input type="text" value={username} onChange={e=>setUsername(e.target.value)} placeholder="請輸入帳號" required className="w-full px-5 py-3 md:px-6 md:py-4 border-2 border-gray-100 rounded-full text-base bg-gray-50 focus:outline-none focus:border-[#84fab0] focus:bg-white focus:ring-4 focus:ring-[#84fab0]/20 transition-all" />
            </div>
            <div>
              <label className="block text-[#7d778b] mb-2 text-sm font-semibold pl-3 transition-colors">密碼</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="請輸入密碼" required className="w-full px-5 py-3 md:px-6 md:py-4 border-2 border-gray-100 rounded-full text-base bg-gray-50 focus:outline-none focus:border-[#84fab0] focus:bg-white focus:ring-4 focus:ring-[#84fab0]/20 transition-all" />
            </div>
            <button type="submit" className={`w-full py-3 md:py-4 mt-2 rounded-full text-base md:text-lg font-bold text-white tracking-widest bg-gradient-to-br from-[#84fab0] to-[#8fd3f4] shadow-[0_8px_24px_rgba(132,250,176,0.3)] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(132,250,176,0.4)] active:scale-95 transition-all relative overflow-hidden btn-login ${isSubmitting ? 'opacity-80 pointer-events-none' : ''}`}>
              {isSubmitting ? '🌱 系統啟動中...' : '✨ 進入牧場'}
            </button>
          </form>
          <div className="mt-6 md:mt-8 text-xs text-gray-300 font-normal">© 2026 Deer MIS · 用心守護每一隻鹿</div>
        </div>
      </div>
    </div>
  );
}

// --- Dashboard View ---
function Dashboard({ deerList, issueLogs, onAddIssue, onUpdateIssueStatus, onDeleteIssue, username }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const activeDeerCount = deerList.filter(d => d.status === 'Active').length;
  
  const [reportData, setReportData] = useState({ deer_id: '', issue_type: '健康異常', description: '' });

  useEffect(() => {
    let interval;
    loadScript('https://cdn.jsdelivr.net/npm/chart.js').then(() => {
      if (!chartRef.current) return;
      const ctx = chartRef.current.getContext('2d');
      
      const calcTHI = (T, RH) => +(T - (0.55 - 0.0055 * RH) * (T - 14.5)).toFixed(1);
      const genEnvPoint = () => {
        const temp = +(18 + Math.random() * 14).toFixed(1);
        const hum  = +(45 + Math.random() * 35).toFixed(0);
        const nh3  = +(1 + Math.random() * 25).toFixed(0);
        return { t: Date.now(), temp, hum, nh3, thi: calcTHI(temp, hum) };
      };

      const series = Array.from({length: 24}, (_, i) => {
        const p = genEnvPoint();
        p.t = Date.now() - (23 - i) * 3600 * 1000;
        return p;
      });

      const labels = series.map(p => `${String(new Date(p.t).getHours()).padStart(2,"0")}:00`);

      if (chartInstance.current) chartInstance.current.destroy();
      
      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label:"溫度(°C)", data: series.map(p=>p.temp), borderColor:"#e8a050", backgroundColor:"rgba(232,160,80,0.08)", tension:0.35, pointRadius:0, borderWidth:2, fill: true },
            { label:"濕度(%)",  data: series.map(p=>p.hum),  borderColor:"#6b9fe8", backgroundColor:"rgba(107,159,232,0.08)", tension:0.35, pointRadius:0, borderWidth:2, fill: true },
            { label:"NH₃(ppm)", data: series.map(p=>p.nh3),  borderColor:"#c87060", backgroundColor:"rgba(200,112,96,0.08)", tension:0.35, pointRadius:0, borderWidth:2 },
            { label:"THI",      data: series.map(p=>p.thi),  borderColor:"#8fc870", backgroundColor:"rgba(143,200,112,0.08)", tension:0.35, pointRadius:0, borderWidth:2 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { family: "'Noto Sans TC', sans-serif" } } } },
          scales: { x: { grid: { color: "#f0f0f0" } }, y: { grid: { color: "#f0f0f0" } } }
        }
      });

      interval = setInterval(() => {
        if (!chartInstance.current) return;
        series[series.length-1] = genEnvPoint();
        chartInstance.current.data.datasets[0].data = series.map(p=>p.temp);
        chartInstance.current.data.datasets[1].data = series.map(p=>p.hum);
        chartInstance.current.data.datasets[2].data = series.map(p=>p.nh3);
        chartInstance.current.data.datasets[3].data = series.map(p=>p.thi);
        chartInstance.current.update();
      }, 3000);
    });

    return () => {
      if (interval) clearInterval(interval);
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, []);

  const handleReportSubmit = (e) => {
    e.preventDefault();
    const newLog = {
      date: new Date().toISOString().split('T')[0],
      ...reportData,
      status: '未處理'
    };
    onAddIssue(newLog);
    setReportData({ deer_id: '', issue_type: '健康異常', description: '' });
  };

  const todayStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl md:rounded-3xl p-6 md:p-10 shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-white relative overflow-hidden transition-transform hover:-translate-y-1 group">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#84fab0] to-[#8fd3f4]"></div>
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">👋 早安, {username}!</h2>
        <p className="text-gray-500 font-medium text-sm md:text-lg">這裡是今日牧場概況 · {todayStr}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard label="🦌 在養頭數" value={activeDeerCount} desc="正常運作" />
        <MetricCard label="💧 環境濕度" value="65.2" suffix="%" desc="適宜" />
        <MetricCard label="🌡️ 即時氣溫" value="28.5" suffix="°C" desc="舒適範圍" />
        <MetricCard label="💨 氨氣監測" value="5.2" suffix="ppm" desc="正常水平" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
          <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50">📊 環境趨勢分析</h3>
          <div className="h-[250px] md:h-[350px] w-full"><canvas ref={chartRef}></canvas></div>
        </div>

        <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all">
          <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50">🔔 系統通知</h3>
          <div className="space-y-4">
            <NotificationCard type="success" title="✅ 設備正常" desc="早上 09:00 自動餵料機運作正常" />
            <NotificationCard type="warning" title="📝 待辦提醒" desc="D-24004 號母鹿預產期接近 (剩 3 天)" />
            <NotificationCard type="info" title="💡 數據更新" desc="本月平均體重增長 +2.3 kg" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100">
        <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50">📢 異常回報與追蹤</h3>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-10">
          <div className="lg:col-span-2">
            <h4 className="text-base md:text-lg font-bold text-gray-700 mb-4">📝 新增問題回報</h4>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">🦌 鹿隻編號 (ID)</label>
                <input type="text" required value={reportData.deer_id} onChange={e=>setReportData({...reportData, deer_id: e.target.value})} placeholder="例如: D-1024" className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">⚠️ 問題類型</label>
                <select value={reportData.issue_type} onChange={e=>setReportData({...reportData, issue_type: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-green-500 transition-all outline-none">
                  <option value="健康異常">🤒 健康異常 (食慾不振/受傷)</option>
                  <option value="設備故障">🛠️ 設備故障 (柵欄/飲水器)</option>
                  <option value="環境問題">🌡️ 環境問題 (溫度/異味)</option>
                  <option value="其他">📝 其他事項</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">詳細描述</label>
                <textarea rows="3" required value={reportData.description} onChange={e=>setReportData({...reportData, description: e.target.value})} placeholder="請描述觀察到的狀況..." className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-green-500 transition-all outline-none resize-y"></textarea>
              </div>
              <button type="submit" className="w-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-green-500/30 hover:-translate-y-1 transition-all">送出回報</button>
            </form>
          </div>
          
          <div className="lg:col-span-3">
            <h4 className="text-base md:text-lg font-bold text-gray-700 mb-4">📋 最近回報紀錄</h4>
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs md:text-sm uppercase tracking-wider">
                    <th className="p-3 md:p-4 border-b-2 border-gray-200">日期</th>
                    <th className="p-3 md:p-4 border-b-2 border-gray-200">鹿號</th>
                    <th className="p-3 md:p-4 border-b-2 border-gray-200">類型</th>
                    <th className="p-3 md:p-4 border-b-2 border-gray-200 hidden sm:table-cell">描述</th>
                    <th className="p-3 md:p-4 border-b-2 border-gray-200 text-center">操作/狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm md:text-base">
                  {issueLogs.slice(0, 6).map((log, i) => (
                    <tr key={log.firebaseId || i} className="hover:bg-green-50/50 transition-colors">
                      <td className="p-3 md:p-4 text-gray-600">{log.date}</td>
                      <td className="p-3 md:p-4 font-bold text-gray-800">{log.deer_id}</td>
                      <td className="p-3 md:p-4 text-gray-600">{log.issue_type}</td>
                      <td className="p-3 md:p-4 text-gray-600 hidden sm:table-cell max-w-[150px] truncate" title={log.description}>{log.description}</td>
                      <td className="p-3 md:p-4 text-center flex items-center justify-center gap-2 flex-wrap">
                        {log.firebaseId ? (
                          <>
                            <select 
                              value={log.status} 
                              onChange={(e) => onUpdateIssueStatus(log.firebaseId, e.target.value)}
                              className={`px-2 py-1 rounded-md text-xs font-bold border-none outline-none cursor-pointer text-center ${log.status === '未處理' ? 'bg-red-100 text-red-700' : log.status === '已解決' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
                            >
                              <option value="未處理">未處理</option>
                              <option value="處理中">處理中</option>
                              <option value="已解決">已解決</option>
                            </select>
                            <button onClick={() => onDeleteIssue(log.firebaseId)} className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors">刪除</button>
                          </>
                        ) : (
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.status === '未處理' ? 'bg-red-100 text-red-700' : log.status === '已解決' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{log.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {issueLogs.length === 0 && (
                     <tr><td colSpan="5" className="p-8 text-center text-gray-400">📭 目前沒有任何異常回報紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, suffix, desc }) {
  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 relative overflow-hidden group hover:-translate-y-2 hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)] transition-all">
      <div className="absolute inset-0 bg-gradient-to-br from-green-400/5 to-blue-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="text-gray-500 font-bold mb-2 md:mb-4 relative z-10 text-sm md:text-base">{label}</div>
      <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent mb-1 md:mb-2 relative z-10 tracking-tight">
        {value} <span className="text-base md:text-lg font-medium text-gray-400">{suffix}</span>
      </div>
      <div className="text-xs md:text-sm text-gray-400 font-medium relative z-10">{desc}</div>
    </div>
  );
}

function NotificationCard({ type, title, desc }) {
  const colors = {
    success: 'border-green-400 bg-gradient-to-br from-white to-green-50',
    warning: 'border-orange-400 bg-gradient-to-br from-white to-orange-50',
    info: 'border-blue-400 bg-gradient-to-br from-white to-blue-50'
  };
  return (
    <div className={`p-4 rounded-xl md:rounded-2xl border-l-4 shadow-sm hover:translate-x-2 transition-transform ${colors[type]}`}>
      <div className="font-bold text-gray-800 mb-1 text-sm md:text-base">{title}</div>
      <div className="text-gray-500 text-xs md:text-sm leading-relaxed">{desc}</div>
    </div>
  );
}

// --- Deer Profiles View ---
function DeerProfiles({ deerList, onAdd, onUpdate, onDelete }) {
  const initialState = { deer_id: '', ear_tag: '', breed: '台灣水鹿', sex: 'M', sire_id: '', dam_id: '', source: '自繁', purpose: '採茸', birth_date: '', pen_id: '', status: 'Active', antler_grade: 'A' };
  const [formData, setFormData] = useState(initialState);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const savePayload = { 
      ...formData, 
      current_pen_id: formData.pen_id, 
      id: formData.deer_id,
      antler_grade: formData.antler_grade || 'A' 
    };

    if (editingId) {
      onUpdate(editingId, savePayload);
      setEditingId(null);
    } else {
      onAdd(savePayload);
    }
    setFormData(initialState);
  };

  const handleEdit = (deer) => {
    setFormData({
      deer_id: deer.id || deer.deer_id || '',
      ear_tag: deer.ear_tag || '',
      breed: deer.breed || '台灣水鹿',
      sex: deer.sex || 'M',
      sire_id: deer.sire_id || '',
      dam_id: deer.dam_id || '',
      source: deer.source || '自繁',
      purpose: deer.purpose || '採茸',
      birth_date: deer.birth_date || '',
      pen_id: deer.current_pen_id || '',
      status: deer.status || 'Active',
      antler_grade: deer.antler_grade || 'A'
    });
    setEditingId(deer.firebaseId);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 編輯時滾動至頂部表單
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData(initialState);
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-[20px] p-6 md:p-8 mb-6 md:mb-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-3">📋 鹿隻數位身分證</h1>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-5 py-2 rounded-full font-bold shadow-md text-sm md:text-base">🦌 總計 {deerList.length} 頭</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] gap-6 md:gap-8 items-start">
        {/* Registration/Edit Form */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 lg:sticky top-[90px]">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50 flex items-center gap-2">
            {editingId ? '✏️ 編輯鹿隻資料' : '➕ 鹿隻入籍登記'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-500 my-4 before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200">📝 基本識別資料</div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🏷️ 牧場編號 (ID)</label><input type="text" required value={formData.deer_id} onChange={e=>setFormData({...formData, deer_id: e.target.value})} placeholder="如：D-11201" className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none transition-colors" /></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🎫 官方耳標號</label><input type="text" value={formData.ear_tag} onChange={e=>setFormData({...formData, ear_tag: e.target.value})} placeholder="防疫耳標" className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none transition-colors" /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🧬 品種</label><select value={formData.breed} onChange={e=>setFormData({...formData, breed: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none"><option>台灣水鹿</option><option>紅鹿</option><option>梅花鹿</option><option>雜交種</option></select></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">⚧️ 性別</label><select value={formData.sex} onChange={e=>setFormData({...formData, sex: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none"><option value="M">公 (Male)</option><option value="F">母 (Female)</option></select></div>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-500 my-4 before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200">🧬 血統與來源</div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">👨 父系編號</label><input type="text" value={formData.sire_id} onChange={e=>setFormData({...formData, sire_id: e.target.value})} placeholder="選填" className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none" /></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">👩 母系編號</label><input type="text" value={formData.dam_id} onChange={e=>setFormData({...formData, dam_id: e.target.value})} placeholder="選填" className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none" /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">📥 來源</label><select value={formData.source} onChange={e=>setFormData({...formData, source: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none"><option>場內自繁</option><option>外部購入</option></select></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🎯 飼養用途</label><select value={formData.purpose} onChange={e=>setFormData({...formData, purpose: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none"><option>採茸用</option><option>種鹿繁殖</option><option>肉用</option></select></div>
            </div>

            <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-gray-500 my-4 before:content-[''] before:flex-1 before:h-px before:bg-gray-200 after:content-[''] after:flex-1 after:h-px after:bg-gray-200">📅 現況資料</div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🎂 出生日期</label><input type="date" required value={formData.birth_date} onChange={e=>setFormData({...formData, birth_date: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none" /></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🏠 所在欄位</label><input type="text" value={formData.pen_id} onChange={e=>setFormData({...formData, pen_id: e.target.value})} placeholder="如：A-01" className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none" /></div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-600 mb-1">📊 目前狀態</label>
                <select required value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none"><option value="Active">🟢 在養 (Active)</option><option value="Sold">🔵 已售 (Sold)</option><option value="Dead">🔴 死亡 (Dead)</option><option value="Quarantine">🟡 隔離中 (Quarantine)</option></select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-bold text-gray-600 mb-1">🦌 鹿茸分級</label>
                <select value={formData.antler_grade} onChange={e=>setFormData({...formData, antler_grade: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-indigo-400 outline-none">
                  <option value="SA">SA (頂級)</option><option value="A">A 級</option><option value="B">B 級</option><option value="C">C 級</option>
                  <option value="SPIKER">Spiker (幼角)</option><option value="RG">RG (再生)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              {editingId && (
                <button type="button" onClick={handleCancelEdit} className="flex-1 bg-gray-100 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors">取消修改</button>
              )}
              <button type="submit" className={`flex-2 w-full ${editingId ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600'} text-white font-bold py-3 rounded-xl shadow-lg hover:-translate-y-0.5 transition-transform`}>
                {editingId ? '💾 儲存修改' : '✅ 確認入籍'}
              </button>
            </div>
          </form>
        </div>

        {/* Deer Table */}
        <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-100 overflow-hidden w-full">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50 flex items-center gap-2">🔍 鹿籍總表</h2>
          <div className="overflow-x-auto lg:h-[750px] lg:overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="bg-gray-50 lg:sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase">編號 / 耳標</th>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase">品種 / 性別</th>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase hidden sm:table-cell">親代 / 出生</th>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase">欄位</th>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase">狀態</th>
                  <th className="p-3 md:p-4 text-gray-600 font-bold text-xs md:text-sm uppercase text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm md:text-base">
                {deerList.map((row, i) => (
                  <tr key={row.firebaseId || i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 md:p-4">
                      <div className="font-extrabold text-gray-800 text-base md:text-lg">{row.id || row.deer_id}</div>
                      {row.ear_tag && <div className="inline-block px-2 py-0.5 mt-1 bg-gray-100 border border-gray-200 rounded text-xs font-mono text-gray-600">{row.ear_tag}</div>}
                    </td>
                    <td className="p-3 md:p-4">
                      <div className="font-bold text-gray-600 mb-1">{row.breed}</div>
                      {row.sex === 'M' ? <span className="text-blue-700 font-bold text-xs md:text-sm">♂ 公鹿</span> : <span className="text-pink-700 font-bold text-xs md:text-sm">♀ 母鹿</span>}
                    </td>
                    <td className="p-3 md:p-4 hidden sm:table-cell">
                      <div className="text-xs md:text-sm text-gray-500 leading-relaxed mb-1">♂: {row.sire_id || '-'}<br/>♀: {row.dam_id || '-'}</div>
                      <div className="text-xs font-bold text-indigo-500">{row.birth_date}</div>
                    </td>
                    <td className="p-3 md:p-4 font-bold text-gray-800">{row.current_pen_id || row.pen_id || '-'}</td>
                    <td className="p-3 md:p-4">
                      <span className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-bold whitespace-nowrap ${row.status === 'Active' ? 'bg-green-100 text-green-800' : row.status === 'Quarantine' ? 'bg-yellow-100 text-yellow-800' : row.status === 'Sold' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>{row.status}</span>
                    </td>
                    <td className="p-3 md:p-4 text-center">
                      {row.firebaseId && (
                        <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
                          <button onClick={() => handleEdit(row)} className="text-indigo-500 hover:text-indigo-700 font-bold text-xs md:text-sm bg-indigo-50 hover:bg-indigo-100 px-2 sm:px-3 py-1 rounded transition-colors">修改</button>
                          <button onClick={() => onDelete(row.firebaseId)} className="text-red-500 hover:text-red-700 font-bold text-xs md:text-sm bg-red-50 hover:bg-red-100 px-2 sm:px-3 py-1 rounded transition-colors">刪除</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Feeding View ---
function Feeding({ feedLogs, onAddFeed, onDeleteFeed, username }) {
  const [formData, setFormData] = useState({ feed_period: 'AM', weather: '晴', target_group: '全場', area_id: '', feed_content: 'TMR', amount: '', leftover: '', note: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newLog = {
      feed_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      ...formData,
      given_amount_kg: parseFloat(formData.amount),
      leftover_amount_kg: parseFloat(formData.leftover || 0),
      feeder: username
    };
    onAddFeed(newLog);
    setFormData({ ...formData, amount: '', leftover: '', note: '' });
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-white rounded-[20px] p-6 md:p-8 mb-6 md:mb-8 shadow-sm flex flex-col items-start border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">🌾 飼養管理日誌</h1>
        <div className="text-gray-500 text-sm">精準飼養 · 成本控管 · 健康追蹤</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] xl:grid-cols-[450px_1fr] gap-6 md:gap-8 items-start">
        {/* Feeding Form */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 lg:sticky top-[90px]">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50">📝 新增餵食紀錄</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">⏰ 餵食時段</label><select value={formData.feed_period} onChange={e=>setFormData({...formData, feed_period: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500"><option value="AM">☀️ 晨間 (AM)</option><option value="PM">🌙 傍晚 (PM)</option><option value="Add">➕ 額外補料</option></select></div>
              <div className="flex-1"><label className="block text-sm font-bold text-gray-600 mb-1">🌦️ 當下天氣</label><select value={formData.weather} onChange={e=>setFormData({...formData, weather: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500"><option>晴</option><option>陰</option><option>雨</option><option>熱</option><option>寒</option></select></div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">🎯 對象群體 / 欄位</label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <select value={formData.target_group} onChange={e=>setFormData({...formData, target_group: e.target.value})} className="flex-1 p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500"><option>全場</option><option>公鹿區</option><option>母鹿區</option><option>仔鹿區</option><option>隔離區</option></select>
                <input type="text" value={formData.area_id} onChange={e=>setFormData({...formData, area_id: e.target.value})} placeholder="指定欄號" className="flex-1 p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500" />
              </div>
            </div>
            <div><label className="block text-sm font-bold text-gray-600 mb-1">🍲 飼料內容</label><select value={formData.feed_content} onChange={e=>setFormData({...formData, feed_content: e.target.value})} className="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500"><option>TMR</option><option>青割玉米</option><option>牧草</option><option>精料</option><option>酒粕</option></select></div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <label className="block text-sm font-bold text-gray-600 mb-1">⚖️ 投餵量</label>
                <input type="number" step="0.1" required value={formData.amount} onChange={e=>setFormData({...formData, amount: e.target.value})} placeholder="0.0" className="w-full p-2.5 pr-8 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500" />
                <span className="absolute right-3 top-9 text-gray-400 font-bold text-sm">kg</span>
              </div>
              <div className="flex-1 relative">
                <label className="block text-sm font-bold text-gray-600 mb-1">🥣 昨餐剩料</label>
                <input type="number" step="0.1" value={formData.leftover} onChange={e=>setFormData({...formData, leftover: e.target.value})} placeholder="0.0" className="w-full p-2.5 pr-8 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500" />
                <span className="absolute right-3 top-9 text-gray-400 font-bold text-sm">kg</span>
              </div>
            </div>
            <div><label className="block text-sm font-bold text-gray-600 mb-1">💊 備註</label><textarea rows="2" value={formData.note} onChange={e=>setFormData({...formData, note: e.target.value})} placeholder="添加益生菌、礦鹽..." className="w-full p-2.5 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500"></textarea></div>
            <button type="submit" className="w-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:-translate-y-0.5 transition-transform mt-4">✅ 記錄存檔</button>
          </form>

          <div className="bg-blue-50 rounded-xl p-4 md:p-5 mt-6 md:mt-8 border-l-4 border-blue-400 hidden sm:block">
            <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">📚 飼養管理參考指標</h4>
            <ul className="text-xs md:text-sm text-blue-900 list-disc pl-4 space-y-1">
              <li><strong>DMI</strong>：若剩料過多(&gt;5-10%)，應減少投餵以免浪費。</li>
              <li><strong>天氣影響</strong>：氣溫超過 28°C 時，建議在涼爽時段增加餵食比例。</li>
              <li><strong>階段營養</strong>：公鹿長茸期需高蛋白(16-18%)，母鹿泌乳期需高能量。</li>
            </ul>
          </div>
        </div>

        {/* Feeding Table */}
        <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm border border-gray-100 overflow-hidden w-full">
          <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50">📊 近期飼養紀錄</h2>
          <div className="overflow-x-auto lg:h-[750px] lg:overflow-y-auto pr-2">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="bg-green-50 border-b-2 border-green-100 lg:sticky top-0 z-10">
                <tr>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm">時間/天氣</th>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm">群體/欄位</th>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm">飼料</th>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm">投餵 / 剩料</th>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm hidden sm:table-cell">備註</th>
                  <th className="p-3 md:p-4 text-green-800 font-bold text-xs md:text-sm text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm md:text-base">
                {feedLogs.map((row, i) => (
                  <tr key={row.firebaseId || i} className="hover:bg-gray-50">
                    <td className="p-3 md:p-4">
                      <div className="text-gray-800 font-bold break-words">{row.feed_time}</div>
                      <div className="mt-1 flex items-center flex-wrap gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${row.feed_period==='AM' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>{row.feed_period}</span>
                        <span className="text-xs text-gray-500">{row.weather}</span>
                      </div>
                    </td>
                    <td className="p-3 md:p-4"><div className="font-bold text-gray-700">{row.target_group}</div><div className="text-xs text-gray-500">{row.area_id || '-'}</div></td>
                    <td className="p-3 md:p-4 text-gray-700 break-words">{row.feed_content}</td>
                    <td className="p-3 md:p-4">
                      <div className="text-green-700 font-bold">+{row.given_amount_kg} kg</div>
                      {row.leftover_amount_kg > 0 && <div className="text-red-600 text-xs">剩 {row.leftover_amount_kg} kg</div>}
                    </td>
                    <td className="p-3 md:p-4 text-sm text-gray-600 hidden sm:table-cell max-w-[120px] truncate" title={row.note}>{row.note || '-'}</td>
                    <td className="p-3 md:p-4 text-center">
                      {row.firebaseId && (
                        <button onClick={() => onDeleteFeed(row.firebaseId)} className="text-red-500 hover:text-red-700 font-bold text-xs md:text-sm bg-red-50 hover:bg-red-100 px-2 md:px-3 py-1 rounded transition-colors">刪除</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Digital Twin View (Three.js integration) ---
function DigitalTwin({ deerList, setCurrentPage }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeer, setSelectedDeer] = useState(null);

  const ANTLER_GRADE_MAP = {
    "SA": { label: "SA / Super A（頂級）", use: "高端市場、禮品、出口", feat: "大、對稱、分枝佳、無鈣化。" },
    "A": { label: "A 級（優良）", use: "一般市場或加工", feat: "尺寸標準、形狀完整。" },
    "B": { label: "B 級（中等）", use: "加工（粉末、保健品）", feat: "尺寸稍小或略有瑕疵。" },
    "C": { label: "C 級（普通）", use: "飼料或低階加工", feat: "外型受損或鈣化程度較高。" },
    "SPIKER": { label: "Spiker（幼角）", use: "精華液、滴劑", feat: "幼鹿初生茸，小尖、未分枝。" },
    "RG": { label: "Regrowth（再生茸）", use: "加工或提粉", feat: "尺寸小、分枝不規則。" },
    "HV": { label: "Hard Velvet（硬化茸）", use: "骨粉、膠原蛋白", feat: "已鈣化硬化，不可食用柔茸。" },
    "HA": { label: "Hard Antler（硬角）", use: "工藝品、骨粉", feat: "完全骨化。" }
  };

  useEffect(() => {
    let animationId;
    let deerMeshes = [];

    const initThree = async () => {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js');
      
      const THREE = window.THREE;
      if (!containerRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a24);
      scene.fog = new THREE.Fog(0x1a1a24, 20, 100);

      const camera = new THREE.PerspectiveCamera(50, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
      camera.position.set(0, 15, 40);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      containerRef.current.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      
      for (let z = -40; z <= 40; z += 25) {
        const pointLight = new THREE.PointLight(0xfff5b6, 0.8, 80);
        pointLight.position.set(0, 18, z);
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 1024;
        pointLight.shadow.mapSize.height = 1024;
        scene.add(pointLight);
        
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 16, 16), 
          new THREE.MeshBasicMaterial({ color: 0xffffee })
        );
        bulb.position.set(0, 19, z);
        scene.add(bulb);
      }

      const buildIndoorBarn = () => {
        const barnGroup = new THREE.Group();
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4036, roughness: 1.0 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x6e757a, roughness: 0.9, metalness: 0.1 });
        
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 120), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        barnGroup.add(floor);

        const createWall = (w, h, d, x, y, z) => {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
          wall.position.set(x, y, z);
          wall.receiveShadow = true;
          barnGroup.add(wall);
        };
        createWall(2, 20, 120, -50, 10, 0);
        createWall(2, 20, 120, 50, 10, 0); 
        createWall(100, 20, 2, 0, 10, -60);
        createWall(100, 20, 2, 0, 10, 60); 
        createWall(100, 2, 120, 0, 21, 0);

        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6, roughness: 0.4 });
        
        const createPen = (cx, cz, w, d) => {
          const h = 4.5;
          for(let px of [cx - w/2, cx + w/2]) {
            for(let pz of [cz - d/2, cz + d/2]) {
              const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, h), pipeMat);
              post.position.set(px, h/2, pz);
              post.castShadow = true;
              post.receiveShadow = true;
              barnGroup.add(post);
            }
          }
          for(let py of [1, 2.5, 4]) {
            for(let pz of [cz - d/2, cz + d/2]) {
              const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w), pipeMat);
              bar.rotation.z = Math.PI/2;
              bar.position.set(cx, py, pz);
              bar.castShadow = true;
              barnGroup.add(bar);
            }
            for(let px of [cx - w/2, cx + w/2]) {
              const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, d), pipeMat);
              bar.rotation.x = Math.PI/2;
              bar.position.set(px, py, cz);
              bar.castShadow = true;
              barnGroup.add(bar);
            }
          }
        };

        for(let i = 0; i < 4; i++) {
          createPen(-25, -40 + i * 25, 40, 20);
          createPen( 25, -40 + i * 25, 40, 20);
        }

        scene.add(barnGroup);
      };

      buildIndoorBarn();
      
      const controls = new window.THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; 
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 5;
      controls.maxDistance = 60;

      const createDeer = () => {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47 });
        
        const bodyGeo = new THREE.SphereGeometry(1, 18, 18);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(0.72, 2.5, 0.72);
        body.rotation.z = Math.PI/2; 
        body.position.y = 1.28; 
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 18), bodyMat);
        head.position.set(1.35, 2.52, 0); 
        head.castShadow = true;
        group.add(head);
        
        return group;
      };

      const activeDeer = deerList.filter(d => d.status === 'Active');
      activeDeer.forEach((d, i) => {
        const mesh = createDeer();
        const isLeft = i % 2 === 0;
        const penRow = Math.floor(i / 2) % 4;
        const cx = isLeft ? -25 : 25;
        const cz = -40 + penRow * 25;
        
        const offsetX = (Math.random() - 0.5) * 35;
        const offsetZ = (Math.random() - 0.5) * 15;
        
        mesh.position.set(cx + offsetX, 0, cz + offsetZ);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        mesh.userData = { id: d.id, isDeer: true, animOffset: Math.random() * 10, data: d };
        scene.add(mesh);
        deerMeshes.push(mesh);
      });

      setLoading(false);

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      
      // Support Touch for mobile
      const handleInteraction = (clientX, clientY) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(deerMeshes, true);
        if (intersects.length > 0) {
          let t = intersects[0].object;
          while(t.parent && !t.userData.isDeer) t = t.parent;
          if (t.userData.isDeer) {
             setSelectedDeer(t.userData.data);
             t.position.y += 0.5; setTimeout(()=>t.position.y-=0.5, 200);
          }
        } else {
          setSelectedDeer(null);
        }
      };

      renderer.domElement.addEventListener('click', (e) => handleInteraction(e.clientX, e.clientY));
      renderer.domElement.addEventListener('touchstart', (e) => {
          if (e.touches.length > 0) handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      const animate = () => {
        animationId = requestAnimationFrame(animate);
        const time = Date.now() * 0.001;
        deerMeshes.forEach(g => {
           g.rotation.y += Math.sin(time * 0.5 + g.userData.animOffset) * 0.001;
        });
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const handleResize = () => {
        if(!containerRef.current) return;
        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      };
      window.addEventListener('resize', handleResize);
    };

    initThree();

    return () => {
      cancelAnimationFrame(animationId);
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [deerList]);

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">🦌 室內數位影子鹿舍 (Digital Twin)</h1>
        <p className="text-gray-500 text-xs md:text-sm">目前場內共有 <b>{deerList.filter(d=>d.status==='Active').length}</b> 頭水鹿 · 點擊 3D 模型查看即時數據</p>
      </div>

      <div className="relative w-full h-[60vh] sm:h-[75vh] bg-white rounded-2xl md:rounded-3xl overflow-hidden shadow-sm border-2 border-gray-100">
        {loading && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col items-center justify-center">
            <div className="w-10 md:w-12 h-10 md:h-12 border-4 border-gray-100 border-t-green-500 rounded-full animate-spin mb-4"></div>
            <div className="text-green-600 font-bold text-sm md:text-base">正在載入 3D 牧場模型...</div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full cursor-pointer"></div>

        <div className={`absolute top-4 sm:top-6 left-4 sm:left-6 w-[calc(100%-2rem)] sm:w-[340px] max-w-[340px] bg-white/95 backdrop-blur-md p-5 sm:p-6 rounded-2xl shadow-xl border border-gray-200 transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.15)] z-10 ${selectedDeer ? 'translate-x-0' : '-translate-x-[120%]'}`}>
          <button onClick={() => setSelectedDeer(null)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-xl md:text-2xl leading-none">✕</button>
          {selectedDeer && (
            <>
              <div className="text-xl md:text-2xl font-black text-gray-900 mb-3">{selectedDeer.id || selectedDeer.deer_id}</div>
              <hr className="border-t border-dashed border-gray-300 mb-4" />
              
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between"><span className="font-bold text-gray-500">🧬 品種/性別</span><span className="font-bold text-gray-800">{selectedDeer.breed} {selectedDeer.sex==='M'?'♂':'♀'}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">🏠 所在欄位</span><span className="font-bold text-gray-800">{selectedDeer.current_pen_id || selectedDeer.pen_id || '--'}</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">⚖️ 最新體重</span><span className="font-bold text-gray-800">180.2 kg</span></div>
                <div className="flex justify-between"><span className="font-bold text-gray-500">🌡️ 體溫</span><span className="font-bold text-gray-800">38.5 °C</span></div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-500">📊 狀態</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1">🟢 {selectedDeer.status}</span>
                </div>
              </div>

              {selectedDeer.sex === 'M' && (
                <div className="mt-4 p-3 sm:p-4 rounded-xl bg-gray-50 border border-dashed border-gray-300">
                  <div className="font-black text-gray-800 mb-2 flex items-center gap-2 text-sm sm:text-base">
                    🦌 鹿茸分級 
                    <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full text-xs border border-gray-300">
                      {ANTLER_GRADE_MAP[selectedDeer.antler_grade || 'A']?.label.split('（')[0] || 'A'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-700 leading-relaxed">
                    <b>用途：</b>{ANTLER_GRADE_MAP[selectedDeer.antler_grade || 'A']?.use || '--'}<br/>
                    <div className="mt-1"><b>特點：</b>{ANTLER_GRADE_MAP[selectedDeer.antler_grade || 'A']?.feat || '--'}</div>
                  </div>
                </div>
              )}
              <div className="mt-5 text-center">
                <button onClick={() => setCurrentPage('deer_profiles')} className="text-teal-600 font-bold text-xs sm:text-sm hover:underline">查看完整履歷 &rarr;</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Environment View (IoT Dashboard) ---
function Environment() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [time, setTime] = useState(new Date());
  const [sensorData, setSensorData] = useState({
    temp: 28.5, hum: 65.2, nh3: 5.2, thi: 78.5
  });

  // 更新時鐘
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 生成即時動態圖表
  useEffect(() => {
    let interval;
    loadScript('https://cdn.jsdelivr.net/npm/chart.js').then(() => {
      if (!chartRef.current) return;
      const ctx = chartRef.current.getContext('2d');
      const calcTHI = (T, RH) => +(T - (0.55 - 0.0055 * RH) * (T - 14.5)).toFixed(1);

      let currentTemp = 28.5;
      let currentHum = 65.2;
      let currentNh3 = 5.2;
      let timeNow = Date.now();

      // 產生過去的假資料點來填滿初始圖表
      const history = Array.from({length: 20}, (_, i) => {
         let t = currentTemp + (Math.random() * 2 - 1);
         let h = currentHum + (Math.random() * 5 - 2.5);
         let n = currentNh3 + (Math.random() * 1 - 0.5);
         return {
            t: timeNow - (19 - i) * 3000,
            temp: +t.toFixed(1),
            hum: +h.toFixed(1),
            nh3: +Math.max(0, n).toFixed(1)
         };
      });

      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: history.map(d => new Date(d.t).toLocaleTimeString('zh-TW', {hour12:false})),
          datasets: [
            { label: "溫度 (°C)", data: history.map(d=>d.temp), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.05)", tension: 0.4, fill: true, borderWidth: 2 },
            { label: "濕度 (%)", data: history.map(d=>d.hum), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.05)", tension: 0.4, fill: true, borderWidth: 2 },
            { label: "氨氣 (ppm)", data: history.map(d=>d.nh3), borderColor: "#eab308", backgroundColor: "rgba(234,179,8,0.05)", tension: 0.4, fill: true, borderWidth: 2 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: 400, easing: 'linear' },
          plugins: { legend: { labels: { font: { family: "'Noto Sans TC', sans-serif" } } } },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: "#f0f0f0" } }
          }
        }
      });

      // 每 3 秒模擬 IoT 設備傳來新數據
      interval = setInterval(() => {
        timeNow = Date.now();
        currentTemp += (Math.random() * 0.8 - 0.4);
        currentHum += (Math.random() * 2 - 1);
        currentNh3 += (Math.random() * 0.6 - 0.3);
        
        currentNh3 = Math.max(0, currentNh3); // 氨氣不為負數
        if (currentHum > 100) currentHum = 100;
        if (currentHum < 30) currentHum = 30;

        const newData = {
          temp: +currentTemp.toFixed(1),
          hum: +currentHum.toFixed(1),
          nh3: +currentNh3.toFixed(1),
          thi: calcTHI(currentTemp, currentHum)
        };

        setSensorData(newData);

        if (chartInstance.current) {
           const chart = chartInstance.current;
           const timeStr = new Date(timeNow).toLocaleTimeString('zh-TW', {hour12:false});
           chart.data.labels.push(timeStr);
           chart.data.labels.shift();
           chart.data.datasets[0].data.push(newData.temp); chart.data.datasets[0].data.shift();
           chart.data.datasets[1].data.push(newData.hum); chart.data.datasets[1].data.shift();
           chart.data.datasets[2].data.push(newData.nh3); chart.data.datasets[2].data.shift();
           chart.update();
        }
      }, 3000);
    });

    return () => {
      if (interval) clearInterval(interval);
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, []);

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      {/* 科技感標頭區塊 */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-center text-white border border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full mix-blend-overlay filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-3 tracking-wide">📡 環境監控數位儀表板</h1>
          <p className="text-gray-400 mt-2 font-medium text-sm md:text-base">IoT 感測器即時連線與分析中心</p>
        </div>
        <div className="relative z-10 text-center mt-6 md:mt-0 bg-gray-800/80 p-4 md:p-5 rounded-2xl border border-gray-600 shadow-inner">
          <div className="text-3xl md:text-4xl font-black font-mono text-green-400 tracking-wider drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
            {time.toLocaleTimeString('zh-TW', {hour12: false})}
          </div>
          <div className="text-xs md:text-sm font-bold text-gray-400 mt-1 md:mt-2">
            {time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
      </div>

      {/* 數位數值卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <EnvCard title="🌡️ 即時溫度" value={sensorData.temp} unit="°C" status={sensorData.temp > 32 ? 'critical' : sensorData.temp < 15 ? 'warning' : 'normal'} />
        <EnvCard title="💧 相對濕度" value={sensorData.hum} unit="%" status={sensorData.hum > 85 ? 'warning' : 'normal'} />
        <EnvCard title="💨 氨氣濃度 (NH3)" value={sensorData.nh3} unit="ppm" status={sensorData.nh3 > 15 ? 'critical' : sensorData.nh3 > 8 ? 'warning' : 'normal'} />
        <EnvCard title="📊 溫濕度指數 (THI)" value={sensorData.thi} unit="" status={sensorData.thi > 80 ? 'critical' : 'normal'} />
      </div>

      {/* 動態折線圖區塊 */}
      <div className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
         <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4 md:mb-6 pb-4 border-b-2 border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span>📈 感測器歷史趨勢圖</span>
            <span className="flex items-center gap-2 text-xs md:text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 即時更新中</span>
         </h2>
         <div className="h-[300px] md:h-[450px] w-full"><canvas ref={chartRef}></canvas></div>
      </div>
    </div>
  );
}

// 儀表板卡片子元件
function EnvCard({ title, value, unit, status }) {
  const styles = {
    normal: { text: "text-green-600", bg: "bg-green-50", border: "border-green-100", glow: "from-green-400 to-emerald-300" },
    warning: { text: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100", glow: "from-yellow-400 to-orange-300" },
    critical: { text: "text-red-600", bg: "bg-red-50", border: "border-red-100", glow: "from-red-500 to-rose-400" }
  };

  const currentStyle = styles[status];

  return (
    <div className={`rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-md ${currentStyle.bg} ${currentStyle.border}`}>
       <div className="text-gray-600 font-bold mb-2 md:mb-3 relative z-10 text-xs md:text-sm">{title}</div>
       <div className="flex items-baseline gap-2 relative z-10">
          <span className={`text-4xl md:text-5xl font-black tracking-tight font-mono ${currentStyle.text}`}>{value}</span>
          <span className="text-base md:text-lg font-bold text-gray-500">{unit}</span>
       </div>
       <div className={`absolute -right-6 -bottom-6 w-24 h-24 md:w-32 md:h-32 rounded-full opacity-20 bg-gradient-to-br ${currentStyle.glow} blur-xl`}></div>
    </div>
  );
}


// ==========================================
// Global Styles (Keyframes & Animations in JSX)
// ==========================================
function GlobalStyles() {
  return (
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes rotateGradient {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes floatCloud {
        0% { transform: translateX(-10vw) translateY(0); opacity: 0; }
        5% { opacity: 0.7; }
        95% { opacity: 0.7; }
        100% { transform: translateX(110vw) translateY(-20px); opacity: 0; }
      }
      .animate-float-cloud-1 { animation: floatCloud 30s ease-in-out infinite; }
      .animate-float-cloud-2 { animation: floatCloud 35s ease-in-out infinite; animation-delay: 10s; }
      .animate-float-cloud-3 { animation: floatCloud 28s ease-in-out infinite; animation-delay: 5s; }
      
      @keyframes floatDeer {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        50% { transform: translateY(-12px) rotate(-2deg); }
      }
      .animate-float-deer { animation: floatDeer 3s ease-in-out infinite; }
      
      @keyframes gallop {
        0% { transform: translateY(0) rotate(0deg) scaleX(1); }
        100% { transform: translateY(-18px) rotate(-3deg) scaleX(1.05); }
      }
      .animate-gallop { animation: gallop 0.3s infinite alternate ease-in-out; }
      
      @keyframes dashAway {
        0% { left: 50%; opacity: 1; transform: translate(-50%, -50%) scale(1); }
        15% { transform: translate(-50%, -50%) scale(0.95) rotate(8deg); }
        30% { transform: translate(-50%, -50%) scale(1.1) rotate(-5deg); }
        100% { left: -40%; opacity: 0; transform: translate(0, -50%) scale(0.8) rotate(-15deg); }
      }
      .dash-animation { display: block !important; opacity: 1 !important; animation: dashAway 1.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards; }
      
      @keyframes softFadeOut {
        to { opacity: 0; transform: translateY(-30px) scale(0.95); filter: blur(4px); }
      }
      .fade-out { animation: softFadeOut 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1); }

      @keyframes slideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; opacity: 0; }

      .btn-login::before {
        content: ''; position: absolute; top: 50%; left: 50%; width: 0; height: 0; border-radius: 50%;
        background: rgba(255, 255, 255, 0.3); transform: translate(-50%, -50%); transition: width 0.6s, height 0.6s;
      }
      .btn-login:hover::before { width: 300px; height: 300px; }
    `}} />
  );
}
