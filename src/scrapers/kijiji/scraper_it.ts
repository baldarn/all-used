import axios from 'axios';
import { parse } from 'node-html-parser';
import knex from '../../database/Knex';
import appDebug from '../../debug';
import { ScraperOptions } from '../scraper_options';
import { Product } from '../../model/product';
import Apify from 'apify';

const debug = appDebug('kijiji_it:scraper');

const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const scrapeProduct = async (product) => {
  const link = product?.getAttribute('data-href');
  const thumbnail = product.querySelector('img')?.getAttribute('src');
  const title = product.querySelector('.title')?.innerText;
  const place = product.querySelector('.locale')?.innerText;
  const timeString = product.querySelector('.timestamp')?.innerText;
  let createdAt : Date = new Date();

  const timeTokens = timeString.split(' ');
  const time = timeTokens.at(-1)?.split(':');
  createdAt.setHours(+time[0]);
  createdAt.setMinutes(+time[1]);

  if (timeString.includes('Ieri')) {
    createdAt.setDate(createdAt.getDate() - 1);
  } else if (!timeString.includes('Oggi')) {
    createdAt.setDate(+timeTokens.at(0));
    createdAt.setMonth(months.indexOf(timeTokens.at(1)?.split(',').at(0)));
  }

  // scrape product
  const productResp = await axios.get(link)
    .catch((error) => {
      debug.error(`error for link: ${link} ${error}`);
      return null;
    });

  if (productResp == null) {
    return;
  }

  // https://www.kijiji.it/annunci/ricambi-moto/lucca-annunci-viareggio/disco-freno-ng-638-gilera-runner-fx-dd-125-1997-2002/165989451
  const remoteId = link.split('/').at(-1);
  const productParsed = parse(productResp.data);
  const description = productParsed.querySelector('.vip__text-description')?.innerText;
  const price = +productParsed.querySelector('.vip__price')?.innerText?.split(' ').at(0)?.trim().replace(/\./g,'');
  const featuresElements = productParsed.querySelectorAll('.vip__details .definition-list');
  const images = [...productParsed.querySelectorAll('.carousel img')].map((a) => a.getAttribute('src'));

  const item: Product = {
    remoteId,
    vendor: 'kijiji.it',
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
    attributes: [...featuresElements].reduce((memo, featureElement) => {
      const feature = featureElement.childNodes;
      memo[feature[1]?.innerText?.trim()] = feature[3]?.innerText?.trim();
      return memo;
    }, {}),
  };
  await knex('products').insert(item).onConflict(['vendor', 'remoteId']).merge();

  debug.debug(item);
};

const rootUrl = 'https://www.kijiji.it/annunci/';

const kijijiItScraper = async (options : ScraperOptions = {startPage: 1, endPage: 0}) => {
  let index = options.startPage;

  if (options.endPage == 0) {
    // get total pages
    // const resp = await axios.get(rootUrl);
    // options.endPage = +parse(await resp.data).querySelector('.last-page').innerText;
    options.endPage = 3334;
  }

  const requestQueue = await Apify.openRequestQueue('kijiji_it');
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
      promises.push(requestQueue.addRequest({ url: `${rootUrl}?p=${i}` }));``
    }

    await Promise.all(promises).then(() => debug.log('pages added!'));
  }

  const crawler = new Apify.CheerioCrawler({
    requestQueue,
    maxConcurrency: 5,

    handlePageFunction: async ({ request, $ }) => {

      debug.log(`start scrape page ${request.url}`);
      const parsed = parse($.html());
      const products = parsed.querySelectorAll('#search-result [data-href]');

      await Promise.all(products.map((product) => scrapeProduct(product)));
    }
  });

  return crawler;
};

export default kijijiItScraper;
