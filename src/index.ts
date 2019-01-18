import rp from 'request-promise';
import storage from 'node-persist';
import { startServer } from './server';

import { Show, CastMember } from './types/interfaces';
import { sleep } from './lib/helpers';

const RATELIMIT_TIMESPAN: number = 10 * 1000;                 // 10 seconds
const RATELIMIT_CAST_CALLS_PER_TIMESPAN: number = 20;         // 20 calls in timespan
const RATELIMIT_SHOWS_CALLS_PER_TIMESPAN: number = 20;         // 20 calls in timespan
const POLL_FOR_NEW_SHOWS_INTERVAL: number = 60 * 60 * 1000     // every 60 minutes


/**
 * Fetches cast for a single show
 * @param show - a single show
 **/
const getShowCast = async (show: Show) => {
  try {
    const cast = await rp({ 
      uri: `https://api.tvmaze.com/shows/${show.id}/cast`,
      json: true
    });

    // filter the cast data we need and sort cast by birthday
    // referencing interface for clarity
    show.cast = cast.map((c: any) => {
      return <CastMember>{
        id: c.person.id,
        name: c.person.name,
        birthday: c.person.birthday
      }
    }).sort((c1: any, c2: any) => +new Date(c1.birthday) - +new Date(c2.birthday));

    console.log(`Fetched cast for show #${show.id}`);
  } catch (error) {
    console.error(`Error fetching cast for show ${show.id}`, error);
  }

  return <Show>{
    id: show.id,
    name: show.name,
    cast: show.cast
  }; 
}


/**
 * Loads shows from the tvMaze API, which is paged and total results are not provided.
 * We keep fetching pages until it throws 404. 
 * Each consecutive page result is then added to storage until a 404 is thrown.
 * Upon restart resumes at the page that holds results we don't have in storage yet.
 * Once 404 is thrown, the casts are fetched provided we don't have them yet.
 **/
const loadShows = async () => {
  const lastShowId = await storage.getItem('lastShowId');
  let pageToFetch = Math.floor((lastShowId || 0) / 250) + 1;
  let cachedShows: any = [];

  // recursively fetches all the shows from the api
  const _fetchShows = async () => 
    rp({
      uri: `https://api.tvmaze.com/shows?page=${pageToFetch}`,
      json: true
    })
      .then(async (shows: any) => {
        console.log(`Fetched ${shows.length} shows - page ${pageToFetch}`);

        const parsedShows = shows.map((s: any) => <Show>{
            id: s.id,
            name: s.name,
            cast: undefined
          }
        )

        await storage.setItem('lastShowId', shows[shows.length - 1].id);
        cachedShows = await storage.getItem('shows') || [];
        await storage.setItem('shows', cachedShows.concat(parsedShows));
        
        pageToFetch++;

        // make sure to follow rate limit here
        await sleep(RATELIMIT_TIMESPAN / RATELIMIT_SHOWS_CALLS_PER_TIMESPAN);

        // keep fetch shows until we run into 404
        _fetchShows();
      })
      .catch( async err => {
        if(err.statusCode === 404) {

          cachedShows = await storage.getItem('shows') || []; 
          console.log(`Updating casts for cachedShows ${cachedShows.length}`)

          for (const [index, show] of cachedShows.entries()) {
            if(!show.cast) {
              cachedShows[index] = await getShowCast(show);
              await storage.setItem('shows', cachedShows);

              // make sure to follow rate limit here
              await sleep(RATELIMIT_TIMESPAN / RATELIMIT_CAST_CALLS_PER_TIMESPAN);              
            }
          }  
   
          console.log('Done fetching casts!');
        }
      });
  
  _fetchShows();
}

/**
 * Start point of the application
 **/
const start = async () => {
  await storage.init({
    dir: 'data',
    encoding: 'utf8',
  }); 
    
  console.log('Loading dataset, it might take a while before all cast data is available...');

  loadShows(); 
  startServer();

  // start polling for new shows
  setInterval(async () => {
    console.log('Fetching new shows...');
    await loadShows()
  }, POLL_FOR_NEW_SHOWS_INTERVAL);
}


start();