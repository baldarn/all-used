import axios from 'axios';
import { parse } from 'node-html-parser';
import knex from '../../database/Knex';
import appDebug from '../../debug';
import { Product } from '../../model/product';
import { ScraperOptions } from '../scraper_options';
import Apify from 'apify';

const debug = appDebug('subito_it:scraper');

const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

const scrapeProduct = async (product) => {

  const link = product.querySelector('a')?.getAttribute('href');
  const thumbnail = product.querySelector('figure img')?.getAttribute('src');
  const title = product.querySelector('h2')?.textContent;

  // scrape product
  debug.debug(`scraping ${link}`);
  const productResp = await axios.get(link)
    .catch((error) => {
      debug.error(`error for link: ${link} ${error}`);
      return null;
    });

  if (productResp == null) {
    return;
  }
  const document = parse(productResp.data);

  // https://www.subito.it/arredamento-casalinghi/posacenere-monza-400397322.htm
  const remoteId = link.split('-').at(-1)?.split('.').at(0);
  const description = document.querySelector('[class*=AdDescription_description__]')?.textContent;
  const price = +document.querySelector('[class*=classes_price__]')?.textContent?.split('€').at(0).trim().replace(/\./g, '');
  const timeString = document.querySelector('[class*=classes_insertion-date]')?.textContent;

  const createdAt = new Date();

  const timeTokens = timeString.split(' ');
  const time = timeTokens.at(-1)?.split(':');
  createdAt.setHours(+time[0]);
  createdAt.setMinutes(+time[1]);

  if (timeString.includes('Ieri')) {
    createdAt.setDate(createdAt.getDate() - 1);
  } else if (!timeString.includes('Oggi')) {
    createdAt.setDate(+timeTokens.at(0));
    createdAt.setMonth(months.indexOf(timeTokens[1]));
  }

  const place = document.querySelector('[class*=AdInfo>_ad-info__location__text]')?.textContent;
  const featuresElements = document.querySelectorAll('[class*=feature-list_feature-list__] li');
  const images = [...document.querySelectorAll('[class*=CarouselCell_carousel]')].map((a) => a.querySelector('img').getAttribute('src'));

  const item: Product = {
    remoteId,
    vendor: 'subito.it',
    link,
    thumbnail,
    title,
    description,
    createdAt,
    updatedAt: new Date(),
    place,
    price,
    currency: "eur",
    images,
    attributes: [...featuresElements].reduce((memo, featureElement) => {
      const feature = featureElement.querySelectorAll('span');
      memo[feature[0]?.textContent] = feature[1]?.textContent;
      return memo;
    }, {}),
  };
  await knex('products').insert(item).onConflict(['vendor', 'remoteId']).merge();

  debug.debug(item);
};

const rootUrl = 'https://www.subito.it/annunci-italia/vendita/usato/';

const subitoItScraper = async (options : ScraperOptions = {startPage: 1, endPage: 0, force: false}) => {
  let index = options.startPage || 0;

  if (options.endPage == 0) {
    // get total pages
    const resp = await axios.get(rootUrl);
    options.endPage = +parse(await resp.data).querySelectorAll('.unselected-page').at(-1).innerText;
  }

  const requestQueue = await Apify.openRequestQueue('subito_it');
  if (options.force) {
    await requestQueue.drop;
  }

  if (await requestQueue.isEmpty()) {
    debug.log(`adding ${options.endPage - index} pages...`);
    let promises = [];

    for(let i = index; i < options.endPage; i += 1) {
      if(i % 500 == 0) {
        debug.log(`adding page to scraper... ${i} done`);
      }
      promises.push(requestQueue.addRequest({ url: `${rootUrl}?o=${i}` }));``
    }

    await Promise.all(promises).then(() => debug.log('pages added!'));
  }

  const crawler = new Apify.PuppeteerCrawler({
    requestQueue,
    maxConcurrency: 5,
    launchContext: {
      launchOptions: {
        // executablePath: '/usr/bin/chromium-browser'
      },
      stealth: true,
    },

    handlePageFunction: async ({ request, page }) => {
      debug.log(`start scrape subito_it page ${request.url}`);

      const parsed = parse(await page.content());
      const products = [...parsed.querySelectorAll('.items .visible .items__item a')].map((product) => product.parentNode);

      await Promise.all(products.map((product) => scrapeProduct(product)));
    },
  });

  return crawler;
};

export default subitoItScraper;
