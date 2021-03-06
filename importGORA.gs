var sheet = SpreadsheetApp.getActive().getSheetByName('input');

function importGora() {
  var courseIds;
  var courseId;
  var courseName;
  var row;
  
  //ゴルフ場名取得
  var sheetData = sheet.getRange(4,4,1000,2).getValues();
  sheetData.some(function(value,index){
    if(value[0] !== '' && value[1] == ''){
      row = index+4;
      courseName = value[0].replace(/CC(.*)/,'カントリー').replace(/G(.*)/,'ゴルフ').replace(/\[(.*)/,'');
      return true;
    }
    if(i == 999){
      Browser.msgBox('ゴルフ場名を入力してください')
      return;
    }
  })
  
  //コース名検索,候補ID抽出
  var apiUrl =  'https://app.rakuten.co.jp/services/api/Gora/GoraGolfCourseSearch/20170623?format=xml&applicationId=1048505012573217366&keyword=' + courseName;
  var apiXml = UrlFetchApp.fetch(apiUrl,{ muteHttpExceptions:true }).getContentText('UTF-8');
  courseIds = getTags(apiXml,'golfCourseId','<golfCourseId>','');
  
  if(courseIds.length == 0){
    Browser.msgBox('ゴルフ場が見つかりません',Browser.Buttons.OK);
    return;
  }
  
  //コース選択,ID確定
  if(courseIds.length == 1){
    courseId = courseIds[0];
  }else{
    var popText = '該当する番号を入力してください\\n\\n';
    courseIds.forEach(function(value,index){
      popText += index+1 + ". " + getTags(apiXml,'golfCourseName','<golfCourseName>','')[index];
      popText += "\\n";
    })
    
    while(true){
      var courseNum = Browser.inputBox('ゴルフ場選択',popText,Browser.Buttons.OK_CANCEL);
      if(courseNum == 'cancel'){
        return;
      }else if(courseNum > 0 && courseNum < courseIds.length + 1){
        courseId = courseIds[courseNum - 1]
        break;
      }else{
        Browser.msgBox('正しい値を入力してください',Browser.Buttons.OK)
      }
    }
  }
  
  //レイアウトページ取得
  var layoutUrl = 'https://booking.Gora.golf.rakuten.co.jp/guide/layout_disp/c_id/' + courseId;
  var layoutHtml = UrlFetchApp.fetch(layoutUrl,{ muteHttpExceptions:true }).getContentText('x-euc-jp');
  
  //サブコース確定
  var subCourseNames = getTags(layoutHtml,'div','<div class="block-02-header">','');
  var outCourseNum;
  var inCourseNum;
  subCourseNames.forEach(function(value,index,array){
    array[index] = getTags(value,'h2','<h2>','')[0];
  })
  if(subCourseNames.length > 2){
    var popText = '該当する番号を入力してください\\n\\n';
    subCourseNames.forEach(function(value,index){
      popText += index+1 + ". " + value;
      popText += "\\n";
    })
    while(true){
      outCourseNum = Browser.inputBox('前半のコースを選択してください',popText,Browser.Buttons.OK_CANCEL) ;
      if(outCourseNum == 'cancel'){
        return;
      }
      if(outCourseNum > 0 && outCourseNum < subCourseNames.length + 1){
        break;
      }else{
        Browser.msgBox('正しい値を入力してください',Browser.Buttons.OK)
      }
    }
    
    popText = '該当する番号を入力してください\\n\\n';
    subCourseNames.forEach(function(value,index){
      if(index !== outCourseNum - 1){
        popText += index+1 + ". " + value;
        popText += "\\n";
      }
    })
    while(true){
      inCourseNum = Browser.inputBox('後半のコースを選択してください',popText,Browser.Buttons.OK_CANCEL);
      if(inCourseNum == 'cancel'){
        return;
      }
      if(inCourseNum > 0 && inCourseNum < subCourseNames.length + 1 && inCourseNum !== outCourseNum){
        break;
      }else{
        Browser.msgBox('正しい値を入力してください',Browser.Buttons.OK)
      }
    }
  }else{
    outCourseNum = '1';
    inCourseNum = '2';
  }
  
  //Par数取得
  var outPars = getChildTags(layoutHtml,[
    ['div','<div class="section clearfix">','',[outCourseNum - 1]],
    ['tr','<tr>','class="cSort">PAR</td>',0],
    ['td','<td class="ar">','']])
  
  var inPars = getChildTags(layoutHtml,[
    ['div',' class="section clearfix"','',[inCourseNum - 1]],
    ['tr','<tr>','class="cSort">PAR</td>',0],
    ['td','<td class="ar">','']])
  
  
  //ガイドページ取得
  var guideUrl = 'https://booking.Gora.golf.rakuten.co.jp/guide/disp/c_id/' + courseId;
  var guideHtml = UrlFetchApp.fetch(guideUrl,{ muteHttpExceptions:true }).getContentText('x-euc-jp');
  
  
  //種別取得
  var courseType = getChildTags(guideHtml,[
    ['dl','<dl class="clearfix">','<dt>種別</dt>',0],
    ['dd','<dd>','']])[0].trim();
  
  
  //行コピー
  sheet.getRange(sheet.getLastRow(), 10, 1, sheet.getLastColumn() - 9).copyTo(sheet.getRange(row, 10, 1, sheet.getLastColumn() - 9));
  sheet.getRange(sheet.getLastRow(), 10, 1, sheet.getLastColumn() - 9).copyTo(sheet.getRange(row, 10, 1, sheet.getLastColumn() - 9));
  
  //Par数入力
  for(var i = 0; i < 9; i++){
    setData(row, 10+i, outPars[i].replace('&nbsp;',''));
    setData(row, 19+i, inPars[i].replace('&nbsp;',''));
  }
  
  //種別入力
  setData(row, 5, courseType);
  
  //コースレートない時
  if(guideHtml.search(/<table(.*)class="tblInfo tblWordBreak mt05"(.*)>/) == -1){
    Browser.msgBox("楽天GORAにコースレートが載っていません。残念！")
    return;
  }
  
  //グリーン・ティー取得
  var subCourseCombi = getTags(guideHtml,'p','<p class="mt10 wd_break">','')
  var subCourseCombiNum; //コースの組み合わせ。上から何番めか
  var outCourseName = subCourseNames[outCourseNum - 1].replace('コース','');
  var inCourseName = subCourseNames[inCourseNum - 1].replace('コース','');
  
  if(subCourseCombi.length < 2){
    subCourseCombiNum = 0;
  }else{
    subCourseCombi.some(function(value,index){
      if(value.search(outCourseName) !== -1 && value.search(inCourseName) !== -1  ){
        subCourseCombiNum = index;
        return true;
      }
    })
  }
  
  var trs = getChildTags(guideHtml,[
    ['table','<table(.*)class="tblInfo tblWordBreak mt05"(.*)>','',subCourseCombiNum],
    ['tr','<tr>','td']]);
  var greenNames = [];
  var teeNames = [];
  
  trs.forEach(function(value){
    var tds = getTags(value,'td','<td.*?>','');
    if(tds.length == 7){
      greenNames.push(tds[0]);
      teeNames.push([]);
      if(tds[3] > 0){
        teeNames[teeNames.length - 1].push([tds[1],tds[3],tds[5]]);
      }
    }else{
      if(tds[2] > 0){
        teeNames[teeNames.length - 1].push([tds[0],tds[2],tds[4]]);
      }
    }
  })
  
  //グリーン確定
  var greenNum;
  if(greenNames.length == 1){
    greenNum = 0;
  }else{
    var popText = '該当する番号を入力してください\\n\\n';
    greenNames.forEach(function(value,index){
      popText += index+1 + ". " + value.trim();
      popText += "\\n";
    })
    
    while(true){
      greenNum = Browser.inputBox('グリーン選択',popText,Browser.Buttons.OK_CANCEL);
      if(greenNum == 'cancel'){
        return;
      }else if(greenNum > 0 && greenNum < greenNames.length + 1){
        greenNum--;
        break;
      }else{
        Browser.msgBox('正しい値を入力してください',Browser.Buttons.OK)
      }
    }
  }
  
  //ティー確定
  var teeNum;
  if(teeNames[greenNum].length == 1){
    teeNum = 0;
  }else{
    var popText = '該当する番号を入力してください\\n\\n';
    teeNames[greenNum].forEach(function(value,index){
      popText += index+1 + ". " + value[0].trim();
      popText += "\\n";
    })
    
    while(true){
      teeNum = Browser.inputBox('ティー選択',popText,Browser.Buttons.OK_CANCEL);
      if(teeNum == 'cancel'){
        return;
      }else if(teeNum > 0 && teeNum < teeNames[greenNum].length + 1){
        teeNum--;
        break;
      }else{
        Browser.msgBox('正しい値を入力してください',Browser.Buttons.OK)
      }
    }
  }
  
  //コースレート入力
  setData(row, 6, teeNames[greenNum][teeNum][1]);
  
  //ヤーデージ入力
  setData(row, 7, teeNames[greenNum][teeNum][2].replace(',',''));
  
}




function setData(y,x,data){
  var range = sheet.getRange(y, x);
  range.setValue(data);
}

//tagType:'div'とか, tagReg:開始タグの正規表現, elementReg:中に含まれる要素の正規表現
function getTags(xml,tagType,tagReg,elementReg){
  var indexStartTag;
  var xmls = [];
  tagReg = new RegExp(tagReg);
  elementReg = new RegExp(elementReg);
  
  for (var i = 0;true;i++){
    indexStartTag = xml.search(tagReg);
    if(indexStartTag !== -1){
      xml = xml.substring(indexStartTag + xml.match(tagReg)[0].length);
      var copyXml = xml;
      var index = 0;
      var endTagNum = 0; //開始タグに対する終了タグの数。これが1になったら親要素の終了タグとみなす
      var reg = new RegExp("<(/)?" + tagType);
      
      while(endTagNum < 1){
        index += copyXml.search(reg) + 1;
        if(copyXml.match(reg)[0] == "<" + tagType){
          endTagNum --;
        }else{
          endTagNum ++;
        }
        copyXml = xml.substring(index)
      }
      
      if(xml.substring(0,index - 1).search(elementReg) !== -1){
        xmls.push(xml.substring(0,(index - 1)));
      }
      xml = xml.substring((index - 1) + (tagType.length + 3));
    }else{
      break;
    }
  }
  return xmls;
}

function getChildTags(xml,array){
  array.forEach(function(value,index){
    xml = getTags(xml,value[0],value[1],value[2]);
    if(index !== array.length - 1){
      xml = xml[value[3]];
    }
  })
  return xml;
}
