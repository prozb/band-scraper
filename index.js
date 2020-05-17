const puppeteer = require('puppeteer');
const cheerio   = require('cheerio');
const fs        = require('fs');

/**
 * Parsing wikipedia pages to create datasets of different bands
 * @author Pavlo Rozbytskyi
 * @version 1.0.0
 */

/**
 * starting parsing process
 * @param {string} pageHTML - html code of the page 
 */
const startScraping = async (pageHTML) => {
  let $ = cheerio.load(pageHTML);
  // getting parsing output 
  let elements = $('.mw-parser-output').children();
  let index = 0; 
  // getting index of h2 after which is stored content
  for(let i = 0; i < elements.length; i++){
    if(elements[i].name === 'h2'){
      index = i;
      break;
    }
  }

  let filtered = elements.slice(++index);
  // first and last element of studio alums 
  let startAdding = false;
  let newFiltered = [];
  //extracting content from the website
  for(let i = 0; i < filtered.length; i++){
    let current = filtered[i];
    //starting to add all elements into new array
    if(startAdding){
      newFiltered.push(current);
    }
    //parse data if is studio album table or 
    if(current.name === 'h3'){
      if(current.firstChild.attribs.id === 'Studio_albums'){
        startAdding = true;
      }else{
        startAdding = false;
      }
    }
  }
  newFiltered.pop();
  // getting all tables and ignore all another tags
  newFiltered = newFiltered.filter(e => e.name === 'table');
  // not new filtered array contains only needed elements
  let albums = parseTables(newFiltered);

  return albums;
}
/**
 * parsing all tables
 * @param {Array} tables 
 */
const parseTables = tables => {
  let albums = [];
  // iteratign over all tables
  for(let i = 0; i < tables.length; i++){
    let tbody = getChildren(tables[i]).find(child => child.tagName === 'tbody');
    let rows = getChildren(tbody);
    // iterating over all rows of the table 
    // the first is table header, thats why we skip it
    for(let j = 1; j < rows.length; j++){
      // if row has now data, skipping
      if(!checkHasRowData(rows[j])) continue;
      // extracting data row
      let album = getAlbumFromRow(rows[j]);
      albums.push(album);
    }
  } 

  return albums;
}

/**
 * checking row contains data, if not ignore
 * @param {CheerioElement} row 
 */
const checkHasRowData = row => {
  return getChildren(row).find(element => element.tagName === 'td' && !element.attribs.colspan);
}
/**
 * getting album from row
 * @param {CheerioObject} row 
 */
const getAlbumFromRow = row => {
  let album = {};
  let rowElems = getChildren(row);
  // extracting header and data from row
  let albumInfo  = getAlbumInfo(rowElems[1]);
  // extracting links from table row header column
  let albumLinks = getAlbumLinks(rowElems[0]);

  try{
    album.href      = albumLinks.href;
    album.id        = albumLinks.id;
    album.released  = albumInfo.released;
    album.recorded = albumInfo.recorded;
    album.label     = albumInfo.label;
  }catch(e) {
    console.error(e);
  }
  return album;
}
/**
 * extracting link to album and name of the album 
 * from thable row header column 
 * @param {CheerioElement} header 
 */
const getAlbumLinks = header => {
  let info = {};
  // getting all children of table row header column
  getChildren(header).forEach(child => {
    let i = getChildren(child);
    let a = i.find(tag => tag.tagName === 'a');
    // checking tag i contains element a
    if(child && a && a.attribs && a.attribs)
      // extracting href and title
      if(a.attribs.href){
        info.url = 'https://en.wikipedia.org/' + a.attribs.href;
      }
      if(a.attribs.title){
        info.id  = a.attribs.title;
      }
  });

  return info;
}
/**
 * extracting album information form table row data column
 * @param {CheerioElement} element 
 */
const getAlbumInfo = element => {
  let albumInfo = {};
  // extracting children from data column and 
  // getting first ul
  let info = [];
  try{
    info = getChildren(element).find(elem => elem.tagName === 'ul');
  }catch(e){
    console.log();
  }
  if(!info)
    return '';
  // extracting list items from list 
  let ul = getChildren(info);

  ul.forEach(li => {
    if(li.tagName === 'li'){
      // getting first child of li
      let childLi = li.firstChild;
      if(!childLi) return albumInfo;
      //extract release date
      if(childLi.data && childLi.data.includes('Released')){
        albumInfo.released = childLi.data.replace('Released: ', '');
      }
      // extracting record dates
      if(childLi.data && childLi.data.includes('Recorded')){
        albumInfo.recorded = childLi.data.replace('Recorded: ', '');
      }
      // extracting label
      if(childLi.data && childLi.data.includes('Label')){
        // there are two cases to extract label: 
        // 1. when list item contains link to label
        if(childLi.next && childLi.next.tagName && childLi.next.tagName === 'a' && 
           childLi.next.firstChild && childLi.next.firstChild.data){
          albumInfo.label = childLi.next.firstChild.data;
        // 2. when label is hardcoded in li as data
        }else{
          albumInfo.label = childLi.data.replace('Label: ', '');
        }
      }
    }
  });
  return albumInfo;
}
/**
 * getting children of the element, needed beacause 
 * wikipedia lua parser creates some blank elements 
 * that may make data 
 * @param {CheerioElement} element 
 */
const getChildren = element => element.children.filter(e => e.type != 'text');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // await page.goto('https://en.wikipedia.org/wiki/Miles_Davis_discography');
  await page.goto('https://en.wikipedia.org/wiki/Iron_Maiden_discography');
  // await page.goto('https://en.wikipedia.org/wiki/Justin_Bieber_discography');

  // await page.screenshot({path: 'example.png'});
  let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  let content  = await startScraping(bodyHTML); 
  let string   = JSON.stringify(content);

  await fs.writeFile('albums.json', string, 'utf8', () => console.log('parsing completed'));  
  await browser.close();
})();