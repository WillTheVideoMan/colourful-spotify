# Colourful Spotify Player

This was a project experimenting with the use of RESTful APIs, SDKs, Node.js and Express.

## Summary

I like music. I also like colourful things. So, why not bring Spotify and colour together? This project uses the Spotify Web Playback SDK to act as a Spotify Connect Device through which you can play music. It also uses the album art in conjunction with palettify.js (a custom fork of [quantize.js](https://gist.github.com/nrabinowitz/1104622)) to generate a 6 tone colour palette, and uses that palette to generate a gradient fill background.

Finally, to give motion to the background, the Spotify API 'features' endpoint was used to get track features to control movement speed and colour intensity.

## Technology Used

 - Node.js and Express to serve pages and carry out business logic.
 - Spotify Web Playback SDK to handle audio playback.
 - Palettify.js (from [quantize.js](https://gist.github.com/nrabinowitz/1104622)) for performing a [Modified Median Cut](https://en.wikipedia.org/wiki/Median_cut) Algorithm on the album art.
 - Spotify Web API for getting track features.

## Usage

 1. Clone repo
 2. Populate the spotify.json file with your application details. These can be gotten from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/login)
 2. Run `npm install`
 3. Run `node index.js` (or use a process manager like [pm2](https://www.npmjs.com/package/pm2))
 4. Browse to `http://localhost:3000/spotify`
 5. Authenticate the application 
 6. Ta Dah! Colourful Player will now be available in your Connected Devices List.
