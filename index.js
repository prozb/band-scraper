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
  newFiltered = newFiltered.filter(e => e.name === 'table');
  // not new filtered array contains only needed elements
  let albums = parseTables(newFiltered);

  console.log(albums);
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
    let rows = getChildren(getChildren(tables[i])[0]);
    // iterating over all rows of the table 
    // the first is table header, thats why we skip it
    for(let j = 1; j < rows.length; j++){
      let album = getAlbumFromRow(rows[j]);
      albums.push(album);
    }
  } 

  return albums;
}
/**
 * getting album from row
 * @param {CheerioObject} row 
 */
const getAlbumFromRow = row => {
  let album = {};
  let rowElems = getChildren(row);
  // extracting header and data from row
  let header = rowElems[0];
  let dataChildren = getChildren(rowElems[1]);

  album.url      = 'https://en.wikipedia.org/' + getChildren(header)[0].children[0].attribs.href;
  album.id      = getChildren(header)[0].children[0].attribs.title;
  album.released = getChildren(dataChildren[0])[0].firstChild.data.replace('Released: ', '');
  album.recorded = getChildren(dataChildren[0])[1].firstChild.data.replace('Recorded: ', '');
  album.label    = getChildren(getChildren(dataChildren[0])[2])[0].firstChild.data;

  return album;
}
/**
 * getting children of the element
 * @param {CheerioElement} element 
 */
const getChildren = element => element.children.filter(e => e.type != 'text');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://en.wikipedia.org/wiki/Miles_Davis_discography');

  // await page.screenshot({path: 'example.png'});
  let bodyHTML = await page.evaluate(() => document.body.innerHTML);
  let content  = await startScraping(bodyHTML); 
  let string   = JSON.stringify(content);

  await fs.writeFile('albums.json', string, 'utf8');  
  await browser.close();
})();