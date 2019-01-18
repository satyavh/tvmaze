import express, { Request, Response } from "express";
import storage from 'node-persist';
import { ApiResponse } from './types/interfaces';

const PAGE_SIZE = 20;

export const startServer = () => {
  const app = express();

  app.listen(3000, () => console.log('Server listening on port 3000!'));
   
  /**
   * API route to get paged shows
   * @query param: page - page number starting from 1
   **/
  app.get('/shows', async (req: Request, res: Response) => {
    const storedShows = await storage.getItem('shows');
    const page = parseInt(req.query.page);

    res.setHeader('Content-Type', 'application/json');

    if(storedShows) {
      let pagedShows = storedShows;

      // calculate page results, if requested
      if(page) {
        const pointer = (page - 1) * PAGE_SIZE;
        pagedShows = storedShows.slice(pointer, pointer + PAGE_SIZE);   
      }

      return res.json(<ApiResponse>{
        success: true,
        page: page,
        page_size: PAGE_SIZE,        
        total_pages: storedShows.length / PAGE_SIZE,
        total_results: storedShows.length,
        shows: pagedShows,
      });
    }

    return res.json(<ApiResponse>{
      success: false,
      total_results: 0,      
      shows: [],
     });
  });   
}