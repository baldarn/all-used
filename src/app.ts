import autoscoutItScraper from './scrapers/autoscout24/scraper_it';
import bakekaScraper from './scrapers/bakeka/scraper_it';
import kijijiScraper from './scrapers/kijiji/scraper_it';
import subitoItScraper from './scrapers/subito_it/scraper';

const start = async () => {
  (await subitoItScraper()).run();
  (await kijijiScraper()).run();
  (await bakekaScraper()).run();
  (await autoscoutItScraper()).run();
}

start();
