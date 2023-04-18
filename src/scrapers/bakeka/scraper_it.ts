import axios from 'axios';
import { HTMLElement, parse } from 'node-html-parser';
import knex from '../../database/Knex';
import appDebug from '../../debug';
import { ScraperOptions } from '../scraper_options';
import { Product } from '../../model/product';
import Apify from 'apify';

const debug = appDebug('bakeka:scraper');

const scrapeProduct = async (product: HTMLElement) => {
  const link = product.querySelector('a').getAttribute('href');
  const thumbnail = product.querySelector('img')?.getAttribute('src');
  const place = product.querySelector('[data-breadcrumb] strong')?.innerText;
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

  // https://torino.bakeca.it/dettaglio/customer-service-call-center-telemarketing/ricerca-cartomanti-da-casa-al-telefono-asq6183642724?from-premium
  const remoteId = link.split('?').at(0)?.split('-').at(-1);
  const productParsed = parse(productResp.data);
  const title = product.querySelector('.b-ann-title')?.innerText;
  const description = productParsed.querySelector('.b-dett-block-content .b-dett-description')?.innerText;
  const timeArray = productParsed.querySelector('.b-dett-g-info .col-xs-5')?.innerHTML.split('/');
  const createdAt = new Date(`${timeArray[1]}/${timeArray[0]}/${timeArray[2]}`);
  const price = +productParsed.querySelector('.b-dett-value')?.innerText?.split(' ').at(0)?.trim().replace(/\./g,'');
  const featuresElements = productParsed.querySelectorAll('.b-dett-meta');
  const images = [...productParsed.querySelectorAll('.snapper_items img')].map((a) => a.getAttribute('src'));

  const item: Product = {
    remoteId,
    vendor: 'bakeka.it',
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
      memo[featureElement.querySelector('.b-dett-meta-label')?.innerText?.trim()] = featureElement.querySelector('.b-dett-meta-value')?.innerText?.trim();
      return memo;
    }, {}),
  };
  debug.debug(item);

  await knex('products').insert(item).onConflict(['vendor', 'remoteId']).merge();
};

const rootUrl = 'https://www.bakeca.it/annunci/tutte-le-categorie/page/';

const bakekaScraper = async (options : ScraperOptions = {startPage: 1, endPage: 0}) => {
  let index = options.startPage;

  if (options.endPage == 0) {
    // get total pages
    const resp = await axios.get(rootUrl);
    options.endPage = +parse(await resp.data).querySelectorAll('.b-page span')[1].innerText?.split(' ').at(-1);
  }

  const requestQueue = await Apify.openRequestQueue('bakeka.it');
  if (options.force) {
    await requestQueue.drop;
  }

  if (await requestQueue.isEmpty()) {
    debug.log(`adding ${options.endPage - index} pages...`);

    for(let i = index; i < options.endPage; i += 1) {
      if(i % 500 == 0) {
        debug.log(`adding page to scraper... ${i} done`);
      }
      requestQueue.addRequest({ url: `${rootUrl}?p=${i}` });
    }
  }

  const crawler = new Apify.CheerioCrawler({
    requestQueue,
    maxConcurrency: 5,

    handlePageFunction: async ({ request, $ }) => {

      debug.log(`start scrape page ${request.url}`);
      const parsed = parse($.html());
      const products = parsed.querySelectorAll('.annuncio-elenco .b-ann-item-unico');

      await Promise.all(products.map((product) => scrapeProduct(product)));
    }
  });

  return crawler;
};

export default bakekaScraper;
