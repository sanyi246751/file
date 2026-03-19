import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const SAVE_URL = "https://script.google.com/macros/s/AKfycbxJzve7fNO6WZfgEkOASAdsLUBnO9uJuGMlhkQ66giglv0FLBvNRQQ8o4gl3RN_eIVT/exec";

type BidItem = { id: string; name: string };
type Group = { name: string; items: BidItem[] };
type YearData = { groups: Group[]; unassigned: BidItem[] };
type AppState = Record<string, YearData>;

const genId = () => Math.random().toString(36).substr(2, 9);

export default function App() {
  const [state, setState] = useState<AppState>({});
  const [bids, setBids] = useState<any[]>([]);
  const [currentYear, setCurrentYear] = useState<string | null>(null);
  const [activeGroupIdx, setActiveGroupIdx] = useState<number | null>(null);
  
  const [statusMsg, setStatusMsg] = useState("🚀 初始化中...");
  const [statusType, setStatusType] = useState("normal");
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  // 初次讀取資料
  useEffect(() => {
    const loadData = async () => {
      setStatusMsg("📡 讀取資料中...");
      try {
        const res = await fetch(SAVE_URL);
        if (!res.ok) throw new Error("Network response was not ok");
        const json = await res.json();
        
        let fetchedState = json.data || {};
        let fetchedBids = json.bids || [];
        setBids(fetchedBids);

        let years = Object.keys(fetchedState);
        if (years.length === 0 && fetchedBids.length > 0) {
          years = Object.keys(fetchedBids[0]).filter(k => k !== "年度" && k.trim());
          years.forEach(y => fetchedState[y] = { groups: [], unassigned: [] });
        }

        years.forEach(y => {
          fetchedState[y].groups.forEach((g: any) => {
            g.items = g.items.map((i: any) => typeof i === 'string' ? { id: genId(), name: i } : i);
          });
          fetchedState[y].unassigned = fetchedState[y].unassigned.map((i: any) => typeof i === 'string' ? { id: genId(), name: i } : i);

          const allItems = fetchedBids.map(r => r[y] ? r[y].toString().trim() : null).filter(Boolean);
          const usedNames = new Set<string>();
          fetchedState[y].groups.forEach((g: any) => g.items.forEach((i: any) => usedNames.add(i.name)));
          
          const freshUnassigned = allItems.filter(name => !usedNames.has(name)).map(name => ({ id: genId(), name }));
          const existingUnassignedNames = new Set(fetchedState[y].unassigned.map((i: any) => i.name));
          
          freshUnassigned.forEach(item => {
            if(!existingUnassignedNames.has(item.name)) fetchedState[y].unassigned.push(item);
          });
        });

        setState(fetchedState);
        if (years.length > 0) {
          setCurrentYear(years[0]);
        }
        setStatusMsg("✅ 系統已就緒");
        setStatusType("success");
      } catch (e) {
        setStatusMsg("❌ 讀取失敗，請檢查網路");
        setStatusType("error");
      }
    };
    loadData();
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text", id);
    setDraggedItemId(id);
  };

  const handleDragEnd = () => {
    setDraggedItemId(null);
  };

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const moveToActiveGroup = (id: string) => {
    if (activeGroupIdx === null || !currentYear) {
      alert("請先選取分箱標籤");
      return;
    }
    setState(prev => {
      const newState = { ...prev };
      const item = newState[currentYear].unassigned.find(i => i.id === id);
      if (!item) return prev;
      newState[currentYear].unassigned = newState[currentYear].unassigned.filter(i => i.id !== id);
      newState[currentYear].groups[activeGroupIdx].items.push(item);
      return newState;
    });
  };

  const moveToUnassigned = (id: string, idx: number) => {
    if (!currentYear) return;
    setState(prev => {
      const newState = { ...prev };
      const item = newState[currentYear].groups[idx].items.find(i => i.id === id);
      if (!item) return prev;
      newState[currentYear].groups[idx].items = newState[currentYear].groups[idx].items.filter(i => i.id !== id);
      newState[currentYear].unassigned.push(item);
      return newState;
    });
  };

  const onDropUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    if (activeGroupIdx !== null) {
      moveToUnassigned(id, activeGroupIdx);
    }
    setDraggedItemId(null);
  };

  const onDropActive = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    moveToActiveGroup(id);
    setDraggedItemId(null);
  };

  const newGroup = () => {
    if (!currentYear) return;
    const existingNumbers = state[currentYear].groups.map(g => {
      const m = g.name.match(new RegExp(`^${currentYear}-(\\d+)$`));
      return m ? parseInt(m[1], 10) : null;
    }).filter(Boolean) as number[];
    
    let maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    let n = maxNum + 1;
    
    setState(prev => {
      const newState = { ...prev };
      newState[currentYear].groups.push({ name: `${currentYear}-${n}`, items: [] });
      return newState;
    });
    setActiveGroupIdx(state[currentYear].groups.length);
  };

  const deleteGroup = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (!currentYear) return;
    if (!window.confirm("確定刪除此分類？標案將移回未分類。")) return;
    
    setState(prev => {
      const newState = { ...prev };
      const itemsToMove = newState[currentYear].groups[idx].items;
      newState[currentYear].unassigned.push(...itemsToMove);
      newState[currentYear].groups.splice(idx, 1);
      return newState;
    });
    setActiveGroupIdx(null);
  };

  const saveToCloud = () => {
    setIsSaving(true);
    setStatusMsg("🔄 資料上傳中...");
    setStatusType("normal");
    
    fetch(SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(state)
    })
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.text();
    })
    .then(() => {
      setIsSaving(false);
      setStatusMsg("✅ 已儲存至雲端");
      setStatusType("success");
    })
    .catch(err => {
      console.error(err);
      setIsSaving(false);
      setStatusMsg("❌ 儲存失敗");
      setStatusType("error");
      alert("儲存失敗！請檢查網路。");
    });
  };

  const printPreviewFormatted = (allMode = false) => {
    if (!currentYear) return;
    if (!allMode && activeGroupIdx === null) {
      alert("請選擇分箱");
      return;
    }
    if (allMode && state[currentYear].groups.length === 0) {
      alert("尚無分箱");
      return;
    }

    const targetBoxes = allMode 
      ? state[currentYear].groups.map(g => g.name) 
      : [state[currentYear].groups[activeGroupIdx!].name];

    const boxAssignments: Record<string, BidItem[]> = {};
    state[currentYear].groups.forEach(g => boxAssignments[g.name] = g.items);

    const today = new Date();
    const dateStr = `${today.getFullYear() - 1911}年${today.getMonth() + 1}月${today.getDate()}日`;

    let html = `<html><head><title>標案分箱明細表</title><style>
      @media print { @page { size: A4 landscape; margin: 15mm; } }
      body { font-family: "Microsoft JhengHei", sans-serif; background: #fff; margin: 0; padding: 0; }
      .page { page-break-after: always; border: none solid #333; padding: 10px; min-height: 180mm; box-sizing: border-box; position: relative; }
      .header { text-align: center; margin-bottom: 5px; border-bottom: 4px double #005a9e; padding-bottom: 5px; }
      .header h1 { font-size: 28pt; margin: 0; letter-spacing: 10px; padding-bottom: 5px }
      .info-bar { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 5px; }
      .box-title { background: #fff; color: #000; padding: 10px 25px; font-size: 26pt; font-weight: bold; border-radius: 5px; }
      .content-table { width: 100%; border-collapse: collapse; margin-top: 5px; }
      .content-table th { background: #f2f2f2; border: 1px solid #333; padding: 8px; font-size: 22pt; }
      .content-table td { border: 1px solid #333; padding: 8px 8px; font-size: 22pt; }
      .footer { position: absolute; bottom: 30px; left: 30px; right: 30px; display: flex; justify-content: space-between; border-top: none solid #ccc; padding-top: 10px; }
    </style></head><body>`;

    targetBoxes.forEach(boxName => {
      const projects = boxAssignments[boxName] || [];
      html += `
      <div class="page">
        <div class="header"><h1>苗栗縣三義鄉公所標案分類明細表</h1></div>
        <div class="info-bar"><div class="box-title">箱號：${boxName}</div><div style="text-align:right; font-size: 18pt">列印日期：${dateStr}<br></div></div>
        <table class="content-table"><thead><tr><th style="width:60px">序號</th><th>標  案  名  稱</th></tr></thead><tbody>
        ${projects.length > 0 ? projects.map((obj, i) => `<tr><td style="text-align:center">${i+1}</td><td>${obj.name}</td></tr>`).join('') : '<tr><td colspan="2" style="text-align:center;padding:50px;color:#999">此箱無標案</td></tr>'}
        </tbody></table>
        <div class="footer"></div>
      </div>`;
    });

    html += `</body></html>`;
    const w = window.open();
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.print(); }, 500);
    }
  };


  const renderItem = (item: BidItem, isUnassigned: boolean, parentIdx: number | null) => {
    return (
      <div 
        key={item.id} 
        className={`bid-item ${draggedItemId === item.id ? 'dragging' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragEnd={handleDragEnd}
        onClick={() => isUnassigned ? moveToActiveGroup(item.id) : moveToUnassigned(item.id, parentIdx!)}
      >
        <span className="bid-title">{item.name}</span>
        {isUnassigned ? (
          <button className="item-btn add" onClick={(e) => { e.stopPropagation(); moveToActiveGroup(item.id); }}>＋</button>
        ) : (
          <button className="item-btn back" onClick={(e) => { e.stopPropagation(); moveToUnassigned(item.id, parentIdx!); }}>↩</button>
        )}
      </div>
    );
  };

  if (!currentYear || !state[currentYear]) {
    return (
      <div style={{ padding: 20 }}>
        <h2>🏗️ 標案分類管理</h2>
        <div className={`status-badge ${statusType}`}>{statusMsg}</div>
      </div>
    );
  }

  const unassignedItems = state[currentYear].unassigned;
  const activeGroup = activeGroupIdx !== null ? state[currentYear].groups[activeGroupIdx] : null;

  return (
    <>
      <h2>🏗️ 標案分類管理</h2>
      <div className={`status-badge ${statusType}`}>{statusMsg}</div>

      <div className="toolbar">
        <div className="left-controls">
          <select value={currentYear} onChange={e => { setCurrentYear(e.target.value); setActiveGroupIdx(null); }}>
            {Object.keys(state).map(y => <option key={y} value={y}>{y}度</option>)}
          </select>
          <button onClick={newGroup}><span>＋</span> 新增分箱</button>
          <button className="btn-success" onClick={saveToCloud} disabled={isSaving}>
            <span>💾</span> {isSaving ? "儲存中..." : "儲存"}
          </button>
          <button className="btn-purple" onClick={() => printPreviewFormatted(false)}><span>🖨️</span> 預覽</button>
          <button className="btn-dark-purple" onClick={() => printPreviewFormatted(true)}><span>📚</span> 全部列印</button>
        </div>
        <div className="right-controls">
          {state[currentYear].groups.map((g, idx) => (
            <div 
              key={idx} 
              className={`year-box ${activeGroupIdx === idx ? 'selected' : ''}`}
              onClick={() => setActiveGroupIdx(idx)}
            >
              {g.name}
              <span className="delete" onClick={(e) => deleteGroup(e, idx)}>✕</span>
            </div>
          ))}
        </div>
      </div>

      <div className="main-area">
        <div className="panel box-panel">
          <h3>
            {activeGroup ? `📁 分箱：${activeGroup.name}` : "🔍 請點選上方標籤選取分箱"}
          </h3>
          <div 
            className="drop-zone" 
            onDragOver={allowDrop} 
            onDrop={onDropActive}
          >
            {activeGroup ? (
              activeGroup.items.length > 0 ? (
                activeGroup.items.map(item => renderItem(item, false, activeGroupIdx))
              ) : (
                <div className="empty-state">
                  <span>📂</span>
                  尚無標案，請從右側拖曳或點擊加入
                </div>
              )
            ) : (
              <div className="empty-state">
                <span>👆</span>
                請先選取或新增一個分箱
              </div>
            )}
          </div>
        </div>

        <div className="panel unassigned-panel">
          <h3>
            <span>📦 未分類標案</span>
            <span className="count-badge" key={unassignedItems.length}>{unassignedItems.length}</span>
          </h3>
          <div 
            className="drop-zone" 
            onDragOver={allowDrop} 
            onDrop={onDropUnassigned}
          >
            {unassignedItems.length > 0 ? (
              unassignedItems.map(item => renderItem(item, true, null))
            ) : (
              <div className="empty-state">
                <span>🎉</span>
                太棒了！所有標案皆已分類完畢
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
