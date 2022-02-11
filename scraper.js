const puppeteer = require('puppeteer')
const dotenv = require('dotenv')

dotenv.config()

const {
  TS3_CARD_NUMBER,
  TS3_PASSWORD,
  TS3_LOGIN_URL
} = process.env


const check_if_next_transactions_page = async (page) =>  page.evaluate(() => { return !!document.querySelectorAll("img[alt='次ページへ']")[0] })

const get_transactions_from_table = async (page) => page.evaluate(() => {
  var table_content = []

  var rows = document.querySelectorAll("table")[4].querySelectorAll("tr")

  // Should use reduce here
  for(var row_index=2; row_index<rows.length;row_index++){

    table_content.push([]);

    var cells = rows[row_index].querySelectorAll("td");
    for(var cell_index=0; cell_index<cells.length; cell_index ++){
      var content = cells[cell_index].querySelectorAll("span")[0].innerHTML;
      table_content[table_content.length-1].push(content)
    }
    var payment_date = document.getElementById("vo.headVO.PAYDAYYMD").innerHTML;
    table_content[table_content.length-1].push(payment_date)
  }
  return table_content;
})

exports.scrape = async () => {

  console.log(`[Scraper] Started scraping`)
  // returns the content of the target trtansaction table
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.setViewport({ width: 1280, height: 800 })

  // Navigate to main page
  await page.goto(TS3_LOGIN_URL)

  // Login
  page.evaluate( ({TS3_CARD_NUMBER, TS3_PASSWORD}) => {
    document.querySelectorAll("input[name='vo.CORPCARDNO1']")[0].value = TS3_CARD_NUMBER.substring(0, 4)
    document.querySelectorAll("input[name='vo.CORPCARDNO2']")[0].value = TS3_CARD_NUMBER.substring(4, 8)
    document.querySelectorAll("input[name='vo.CORPCARDNO3']")[0].value = TS3_CARD_NUMBER.substring(8, 12)
    document.querySelectorAll("input[name='vo.CORPCARDNO4']")[0].value = TS3_CARD_NUMBER.substring(12, 16)
    document.querySelectorAll("input[name='vo.CARDPW']")[0].value = TS3_PASSWORD
    document.querySelectorAll("a[href='#']")[0].click()
  }, {TS3_CARD_NUMBER, TS3_PASSWORD})
  await page.waitForNavigation()

  page.evaluate(() => { document.querySelectorAll("a[href='#']")[0].click() })
  await page.waitForNavigation();

  page.evaluate(() => { document.querySelectorAll("input[type='button']")[0].click() })
  await page.waitForNavigation()

  // Month selection page
  // Select last available month (index = 2)
  page.evaluate(() => { document.querySelectorAll("a[href='#']")[2].click() })
  //page.evaluate(() => { document.querySelectorAll("a[href='#']")[1].click() })
  await page.waitForNavigation()

  const transactions = []
  const transactions_of_page = await get_transactions_from_table(page)
  transactions_of_page.forEach((transaction) => { transactions.push(transaction) })


  while( await check_if_next_transactions_page(page) ) {
    await page.evaluate(() => {
      const img = document.querySelectorAll("img[alt='次ページへ']")[0]
      img.parentNode.click()
    })
    await page.waitForNavigation()
    const transactions_of_page = await get_transactions_from_table(page)
    transactions_of_page.forEach((transaction) => { transactions.push(transaction) })
  }

  await browser.close()

  console.log(`[Scraper] Successfully scraped ${transactions.length} transactions`)

  console.log(transactions);

  return transactions
}
