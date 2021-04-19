var express = require('express');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var request = require('request');
var bcrypt = require('bcryptjs');
var port = 8080;

var spotify_creds = {
  client_id: "ba12cd1cf3204725861312e25f861a36",
  client_secret: "b288ccc8f1c4437191418d039a140955",
  redirect: "https://spotify.rplwtr.uk/auth/callback",
  scopes: "streaming user-read-birthdate user-read-email user-read-private user-read-currently-playing"
}

var app = express()
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  store: new RedisStore({
    host: 'localhost',
    port: 6379,
    pass: 'QnxfrvZ7/PVt3UQmZZUYIFDbf41kkIY8i4cmQLpW07ppSK7RNUNttpbaLJz0/7+1XQbVOKD0gx4w9/a2'
  }),
  secret: 'keyboard cats',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))

//Handle routes.
app.get('/', function(req, res) {

  //If the session has a refesh_token with it, then the user is authed and ready to go!
  if (req.session.spotify_refresh_token) {
    res.sendFile(__dirname + '/index.html');
  } else {
    res.sendFile(__dirname + '/no_auth.html');
  }

});

//Handle auth route.
app.get('/auth', function(req, res) {

  console.log("auth reached");
  console.log(req.session.id);

  //Define auth variables, including scopes and redirect url.
  var encoded_scopes = encodeURIComponent(spotify_creds.scopes);
  var encoded_redirect = encodeURIComponent(spotify_creds.redirect);

  //Hash the session ID to make the state, so that only the browser that initiated the request is authed.
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(req.session.id, salt, function(err, hash) {
      var encoded_state = encodeURIComponent(hash);
      console.log("ready");
      //redirect to Spotify auth.
      res.redirect('https://accounts.spotify.com/authorize/?client_id=' + spotify_creds.client_id +
        '&response_type=code&redirect_uri=' + encoded_redirect +
        '&scope=' + encoded_scopes +
        '&state=' + encoded_state);

    });
  });
});

//Handle auth callback route.
app.get('/auth/callback', function(req, res) {

  //If there was an error during Auth, then redirect home. Maybe the user cancelled?
  if (req.query.error) {
    res.redirect("/?error=" + req.query.error);
  } else {

    //Compare the state variable, to the hash of the sessID, to confirm request origin.
    bcrypt.compare(req.session.id, req.query.state, function(err, result) {

      //If origins match, you in business.
      if (result) {

        //Build a body of request params.
        const request_body = "grant_type=authorization_code&code=" + req.query.code +
          "&redirect_uri=" + spotify_creds.redirect +
          "&client_id=" + spotify_creds.client_id +
          "&client_secret=" + spotify_creds.client_secret;

        //Define the route we should take to get our new refresh_tokens and stuff my dude.
        const options = {
          url: 'https://accounts.spotify.com/api/token',
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: request_body
        };

        //Request some tokens my dudes. Set the session variable so we never be loosing that token.
        request(options, function(err, response, body) {
          var response_body = JSON.parse(body);
          req.session.spotify_refresh_token = response_body.refresh_token;

          //Redirect us home.
          res.redirect("/");

        });
      }
    });
  }
});

//Handle new token route.
app.get('/auth/token/new', function(req, res) {

  //Build body of params to get us a new access token.
  const request_body = "grant_type=refresh_token&refresh_token=" + req.session.spotify_refresh_token +
    "&client_id=" + spotify_creds.client_id +
    "&client_secret=" + spotify_creds.client_secret;

  //Define where we have to go to get the new token, and how we get there.
  const options = {
    url: 'https://accounts.spotify.com/api/token',
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: request_body
  };

  //Make the request to get a new access_token.
  request(options, function(err, response, body) {

    //If we got the token succesfully, then send it OUT to the client who requested the token.
    if (response.statusCode == 200) {
      var response_body = JSON.parse(body);
      res.json({ "access_token": response_body.access_token });

      //Else, the user has revoked access to their account by us. We need to re-auth.
    } else if (response.statusCode == 400) {
      req.session.spotify_refresh_token = null;
      res.json({ "error": { "reason": "refresh_token_expired" } });

      //Else, something ELSE went wrong... Oh boy.
    } else {
      res.json({ "error": { "reason": "unknown_error" } });
    }
  });
});

//Handle routes.
app.get('/ping', function(req, res) {

  res.sendStatus(200);

});

//Static middleware.
app.use(express.static('public'))

//Listen for requests.
app.listen(port, function() {
  console.log('listening on *:' + port);
});