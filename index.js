const express = require('express');
const app = express();
const http = require('http').Server(app);
const request = require('request');
const fs = require('fs');
var spotify = {};

function getSpotifyConfig(done) {
  fs.readFile('./spotify.json', 'utf8', function(err, data) {
    if (err) throw err;
    obj = JSON.parse(data);
    console.log("The file was read!");
    console.log(obj);
    done(obj);
  });
}

function updateSpotifyConfig(new_object) {
  var object_string = JSON.stringify(new_object);
  fs.writeFile("./spotify.json", object_string, 'utf8', function(err) {
    if (err) throw err;
    console.log("The file was saved!");
    console.log(new_object);
  });
}

//Handle routes.
app.get('/spotify', function(req, res) {

  if (spotify.refresh_token) {
    res.sendFile(__dirname + '/index.html');
  } else {
    res.sendFile(__dirname + '/no_auth.html');
  }

});

//Handle new token route.
app.get('/spotify/auth/token/new', function(req, res) {

  const request_body = "grant_type=refresh_token&refresh_token=" + spotify.refresh_token +
    "&client_id=" + spotify.client_id +
    "&client_secret=" + spotify.client_secret;

  const options = {
    url: 'https://accounts.spotify.com/api/token',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: request_body
  };

  request(options, function(err, response, body) {
    console.log(body);
    if (response.statusCode == 200) {
      var response_body = JSON.parse(body);
      res.json({ "access_token": response_body.access_token });
    } else if (response.statusCode == 400) {
      spotify.refresh_token = "";
      updateSpotifyConfig(spotify);
      res.json({
        "error": { "reason": "refresh_token_expired" }
      });
    } else {
      res.json({
        "error": { "reason": "unknown_error" }
      });
    }
  });
});

//Handle auth route.
app.get('/spotify/auth', function(req, res) {

  //Define auth variables, including scopes and redirect url. State is used to ensure request is valid.
  var encoded_scopes = encodeURIComponent(spotify.scopes);
  var encoded_redirect = encodeURIComponent(spotify.redirect);
  var encoded_state = encodeURIComponent(spotify.state);

  //redirect to Spotify auth.
  res.redirect('https://accounts.spotify.com/authorize/?client_id=' + spotify.client_id +
    '&response_type=code&redirect_uri=' + encoded_redirect +
    '&scope=' + encoded_scopes +
    '&state=' + encoded_state);
});

//Handle auth callback route.
app.get('/spotify/auth/callback', function(req, res) {

  if (req.query.error) {
    console.log("error during auth. Redirecting home.");
    res.redirect("/spotify");
  } else {
    if (spotify.state == req.query.state) {

      const request_body = "grant_type=authorization_code&code=" + req.query.code +
        "&redirect_uri=" + spotify.redirect +
        "&client_id=" + spotify.client_id +
        "&client_secret=" + spotify.client_secret;

      const options = {
        url: 'https://accounts.spotify.com/api/token',
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: request_body
      };

      request(options, function(err, response, body) {
        var response_body = JSON.parse(body);
        spotify.refresh_token = response_body.refresh_token;
        updateSpotifyConfig(spotify);
        res.redirect("/spotify");
      });

    }
  }

});

//Static middleware.
app.use(express.static('public'))

//Read in the Spotify Config.
getSpotifyConfig(function(obj) {
  spotify = obj;
  //Listen for HTTP requests.
  http.listen(3000, function() {
    console.log('listening on *:3000');
  });
});