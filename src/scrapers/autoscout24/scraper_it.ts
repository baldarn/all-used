import axios from 'axios';
import { HTMLElement, parse } from 'node-html-parser';
import knex from '../../database/Knex';
import appDebug from '../../debug';
import { ScraperOptions } from '../scraper_options';
import { Product } from '../../model/product';
import Apify from 'apify';

const debug = appDebug('autoscout24_it:scraper');

const featuresReducer = (memo: Array<Object>, item: HTMLElement) => {
  const newKeys = [...item.querySelectorAll('dt')].map((val) => val.innerText);
  const newValues = [...item.querySelectorAll('dd')].map((val) => val.innerText);

  for (let i = 0; i < newKeys.length; i += 1) {
    memo.push({
      key: newKeys[i],
      value: newValues[i],
    });
  }

  return memo;
};

const scrapeProduct = async (product: HTMLElement) => {
  const link = `https://www.autoscout24.it${product.querySelector('[data-item-name=detail-page-link]').getAttribute('href')}`;
  const remoteId = product.getAttribute('id').split('li-').at(1);
  const thumbnail = product.querySelector('.lazyload')?.getAttribute('data-src');
  // const coordinates = '';

  // scrape product
  const productResp = await axios.get(link)
    .catch((error) => {
      debug.error(`error for link: ${link} ${error}`);
      return null;
    });

  if (productResp == null) {
    return;
  }

  // https://www.autoscout24.it/annunci/jeep-renegade-1-3-t4-ddct-limited-benzina-grigio-88bab878-16ca-499d-9534-0c4fa0cafe2c?cldtidx=1&sort=age&lastSeenGuidPresent=true&cldtsrc=listPage&searchId=-543373015
  const productParsed = parse(productResp.data);
  const place = productParsed.querySelector('.cldt-stage-vendor-text .sc-font-bold')?.innerText;
  const title = [...productParsed.querySelectorAll('.cldt-detail-title')].reduce((val, item) => { val += item.innerText ;return val;}, '');
  const description = productParsed.querySelector('[data-type=description]')?.innerText;
  const createdAt = null;
  const price = +productParsed.querySelector('.cldt-price h2')?.innerText?.split(' ').at(-1)?.split(',').at(0)?.trim().replace(/\./g,'');
  const features = [...productParsed.querySelectorAll('.cldt-categorized-data dl')].reduce(featuresReducer, []);
  const optionals = [...productParsed.querySelectorAll('.cldt-equipment-block span')].map((val) => val.innerHTML);
  const images = [...productParsed.querySelectorAll('.gallery-picture__image')].map((a) => a.getAttribute('src') || a.getAttribute('data-src'));

  const item: Product = {
    remoteId,
    vendor: 'autoscout24.it',
    link,
    thumbnail,
    title: title?.trim(),
    description,
    createdAt,
    updatedAt: new Date(),
    place,
    price,
    currency: "eur",
    images,
    attributes: [...features].reduce((memo, feature: any) => {
      memo[feature.key?.trim()] = feature.value.trim();
      return memo;
    }, {}),
    tags: optionals,
  };
  debug.debug(item);

  await knex('products').insert(item).onConflict(['vendor', 'remoteId']).merge();
};

const rootUrl = 'https://www.autoscout24.it/lst/?sort=age&desc=1&offer=D%2CJ%2CO%2CS%2CU&ustate=N%2CU&size=20&cy=I&atype=C&fc=1';

const autoscout24ItScraper = async (options : ScraperOptions = {startPage: 1, endPage: 0}) => {
  let index = options.startPage;

  if (options.endPage == 0) {
    // get total pages
    const resp = await axios.get(rootUrl);
    const parsed = parse(await resp.data);
    // options.endPage = +parsed.querySelectorAll('.b-page span').at(1).innerText?.split(' ').at(-1);
    options.endPage = 20;
  }

  const requestQueue = await Apify.openRequestQueue('autoscout24.it');
  if (options.force) {
    await requestQueue.drop;
  }

  if (await requestQueue.isEmpty()) {
    debug.log(`adding ${options.endPage - index} pages...`);

    for(let i = index; i < options.endPage; i += 1) {
      if(i % 500 == 0) {
        debug.log(`adding page to scraper... ${i} done`);
      }
      requestQueue.addRequest({ url: `${rootUrl}&page=${i}` });
    }
  }

  const crawler = new Apify.CheerioCrawler({
    requestQueue,
    maxConcurrency: 5,

    handlePageFunction: async ({ request, $ }) => {

      debug.log(`start scrape page ${request.url}`);
      const parsed = parse($.html());
      const products = parsed.querySelectorAll('[data-item-name=listing-summary-container]');

      await Promise.all(products.map((product) => scrapeProduct(product)));
    }
  });

  return crawler;
};

export default autoscout24ItScraper;
