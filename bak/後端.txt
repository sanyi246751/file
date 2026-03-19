// 這個檔案部署為 Web App，允許任何人存取
function doGet(e){
  const ss = SpreadsheetApp.openById("1L0iABgwgyi3iwHVxfx18ObXNevfIsUrPF6YniWGge4Y");
  const sheetData = ss.getSheetByName("data");
  const sheetBids = ss.getSheetByName("標案資料");

  // 讀取 data
  let data = {};
  if(sheetData.getLastRow() > 0){
    const rows = sheetData.getDataRange().getValues();
    // 假設第一列是年度，第一欄是年份
    rows.forEach(row=>{
      const year = row[0];
      try {
        data[year] = JSON.parse(row[1]);
      } catch(e){
        data[year] = {groups:[], unassigned:[]};
      }
    });
  }

  // 讀取標案資料
  let bids = [];
  if(sheetBids.getLastRow() > 0){
    bids = sheetBids.getDataRange().getValues();
    const headers = bids.shift();
    bids = bids.map(r=>{
      let obj = {};
      headers.forEach((h,i)=>{ obj[h]=r[i]; });
      return obj;
    });
  }

  return ContentService
         .createTextOutput(JSON.stringify({data:data, bids:bids}))
         .setMimeType(ContentService.MimeType.JSON);
}

// 儲存前端傳來的分類
function doPost(e){
  const ss = SpreadsheetApp.openById("1L0iABgwgyi3iwHVxfx18ObXNevfIsUrPF6YniWGge4Y");
  const sheetData = ss.getSheetByName("data");

  const json = e.postData.contents;
  const obj = JSON.parse(json);

  // 清空舊資料
  sheetData.clearContents();
  let rowIdx = 1;
  for(const year in obj){
    sheetData.getRange(rowIdx,1).setValue(year);
    sheetData.getRange(rowIdx,2).setValue(JSON.stringify(obj[year]));
    rowIdx++;
  }

  return ContentService.createTextOutput("ok");
}
