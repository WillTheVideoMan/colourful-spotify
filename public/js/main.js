$(function() {

  //Playback and track info variables.
  var local_track = {};
  var is_active_device = false;
  var error_state = false;
  var first_load = true;
  var position_ticker = null;
  var prev_time = Date.now();
  var token = "";
  var online_pinger = window.setInterval(check_online, 5000);

  //Background colour and rotation variables.
  var background = $("#background");
  var angle = 0;
  var rotation_velocity = 0.015;
  var background_opacity = 0.75;
  var rotator_ticker = null;
  var activity_timeout = 2500;
  var controls_hidden = false;
  var inactivity_timer = window.setTimeout(hide_controls, activity_timeout);

  //When Spotify is ready, initialize the player.
  window.onSpotifyWebPlaybackSDKReady = () => {

    //Define the Spotify player object instance.
    const player = new Spotify.Player({
      name: 'Colourful Player',
      getOAuthToken: cb => {
        //Define token update function.
        getToken(function(new_token) {
          cb(new_token);
          token = new_token;
        });
      }
    });

    // Error handling
    player.addListener('initialization_error', ({
      message
    }) => {
      handle_error("init_err");
    });

    player.addListener('authentication_error', ({
      message
    }) => {
      handle_error("auth_err");
    });

    player.addListener('account_error', ({
      message
    }) => {
      handle_error("acc_err'");
    });

    player.addListener('playback_error', ({
      message
    }) => {
      handle_error("play_err");
    });

    // Playback status updates
    player.addListener('player_state_changed', state => {

      //If the player is still the active playback device
      if (state) {

        //Ensure the player knows it is still the active device.
        is_active_device = true;

        //If the song has changed
        if (state.track_window.current_track.id != local_track.id) {
          //Update the local track.
          update_track(state.track_window.current_track);
        }

        //If the song has been paused
        if (state.paused && !local_track.paused) {
          //update the local track paused state.
          local_track.paused = true;
          pause_tickers();
        }

        //If the song has been played
        if (!state.paused && local_track.paused) {
          //update the local track paused state.
          local_track.paused = false;
          resume_tickers();
        }

        //update the local track seek position.
        local_track.position = state.position;

      } else {

        //No longer the active device.
        is_active_device = false;
        console.warn("No longer the active player!");
        reset_player();
        player_ready();

      }

      //Repaint the the track UI with any new data.
      update_track_UI();

      //Repaint the controls UI with any new data;
      update_controls_UI();

    });

    // Ready
    player.addListener('ready', ({
      device_id
    }) => {
      player_ready();
      update_track_UI();
      console.log('Ready with Device ID', device_id);
    });

    // Not Ready
    player.addListener('not_ready', ({
      device_id
    }) => {
      handle_error("device_offline")
      console.log('Device ID has gone offline', device_id);
    });

    //On Play/Pause event.
    $("#play_pause").click(function() {
      if (is_active_device) {
        player.togglePlay().then(() => {
          console.log('Toggled playback!');
        });
      }
    });

    //On prev, handle.
    $("#skip_prev").click(function() {
      if (is_active_device) {
        player.previousTrack().then(() => {
          console.log('Set to previous track!');
        });
      }
    });

    //On skip, handle.
    $("#skip_next").click(function() {
      if (is_active_device) {
        player.nextTrack().then(() => {
          console.log('Skipped to next track!');
        });
      }
    });

    //On position slider mouse down, stop the tickers.
    $("#track_position_slider").on('mousedown', function() {
      if (is_active_device) {
        pause_tickers();
      }
    });

    //On position slider movement, update the local track position and update the control UI.
    $("#track_position_slider").on('input', function() {
      if (is_active_device) {
        local_track.position = $("#track_position_slider").val();
        update_controls_UI();
      }
    });

    //On position change, handle and resume tickers.
    $("#track_position_slider").on('change', function() {
      if (is_active_device) {
        player.seek($("#track_position_slider").val()).then(() => {
          console.log('Changed position!');
          resume_tickers();
        });
      }
    });

    // Connect to the player!
    player.connect();

  };

  //update the local_track object.
  function update_track(new_track) {
    local_track.id = new_track.id;
    local_track.name = new_track.name;
    local_track.art_url = new_track.album.images[2].url;
    local_track.artists = new_track.artists;
    local_track.duration = new_track.duration_ms;
    local_track.type = new_track.type;

    //generate a new palette;
    get_palette_from_image(local_track.art_url, 6, function(palette) {
      local_track.palette = palette;

      //Get track features. Update the background.
      get_features_from_track(local_track, function(features) {
        local_track.features = features;
        set_background_features(local_track.features);

        //Update_background
        update_background();

      });

    });

    console.log(local_track);

  }

  //Repaint the UI elements of the track
  function update_track_UI() {

    if (!error_state) {
      var artists_string = local_track.artists[0].name;

      //If there is more than one artists, then append them to the string.
      if (local_track.artists.length > 1) {
        for (var i = 1; i < local_track.artists.length; i++) {
          artists_string += ", " + local_track.artists[i].name;
        }
      }

      //Update DOM elements
      $("#track_name").text(local_track.name);
      $("#track_artist").text(artists_string);
      $("#track_album_art").attr("src", local_track.art_url);
      $("#track_time_duration").text(ms_to_string(local_track.duration));
      $("#track_position_slider").prop('max', local_track.duration);

      //Update play/pause button
      if (!is_active_device) {
        $("#play_pause").html("remove_circle_outline");
      } else if (local_track.paused) {
        $("#play_pause").html("play_circle_outline");
      } else {
        $("#play_pause").html("pause_circle_outline");
      }
    }

  }

  //Repaint the UI elements of the controls
  function update_controls_UI() {

    if (!error_state) {
      //Update UI.
      $("#track_time_position").text(ms_to_string(local_track.position));
      $("#track_position_slider").val(local_track.position);
    }

  }

  //Reset the player (for whatever reason)
  function reset_player() {

    //reset of the local track object.
    local_track = {
      "id": "",
      "name": "...",
      "artists": [{ "name": "..." }],
      "paused": true,
      "position": 0,
      "duration": 0,
      "art_url": "/images/spotify-640x640.png",
      "type": "",
      "features": {
        "tempo": 50,
        "energy": 0.5,
        "loudness": 0.5,
        "valence": 0.5
      },
      "palette": [
        [36, 212, 92],
        [209, 245, 221],
        [112, 224, 151],
        [139, 228, 172],
        [84, 220, 132],
        [73, 216, 121]
      ]
    };

    console.log(local_track);

    //Since playback is essentially pausing, handle pause.
    pause_tickers();

    //Update UI.
    update_track_UI();
    update_controls_UI();
    set_background_features(local_track.features);
    update_background();
  }

  //prepare the player for playback.
  function player_ready(device_id) {

    /*If the player is ready after an error, remove error banner,
    change to non-error state and re-initialise the UI*/
    if (error_state) {
      ("#error_banner").animate({ bottom: "+=40px" }, 500);
      error_state = false;
      reset_player();
    }

    //If we are ready for the first time.
    if (first_load) {
      first_load = false;
      //TODO hide loader.
    }

    //Update some UI to give info to the user.
    local_track.name = "Ready To Play.";
    local_track.artists[0].name = "Visit any Spotify player and choose 'Custom LED Player' as a device.";

  }

  //returns a colour palette of given size from an image URL.
  function get_palette_from_image(image_url, colour_count, done) {

    //Define a pixel array, and a new image object.
    var pixelArray = [];
    var img = new Image();

    //Allow for API-recieved image from cross-origin. Set URL to remote image.
    img.crossOrigin = "Anonymous";
    img.src = image_url;

    //When the image is received from the origin, begin processing.
    img.onload = function(image) {

      //Get the colour palette from the image. Return.
      done(paletteFromImage(image, colour_count));

    }

  }

  //Function which rotates the gradent background at a speed defined by 'rotation_velocity'.
  function update_background() {
    if (angle > 360) angle = 0;
    background.css("background", "linear-gradient(" + angle + "deg," +
      "rgba(" + local_track.palette[0][0] + "," + local_track.palette[0][1] + "," + local_track.palette[0][2] + "," + background_opacity + ")," +
      "rgba(" + local_track.palette[1][0] + "," + local_track.palette[1][1] + "," + local_track.palette[1][2] + "," + background_opacity + ")," +
      "rgba(" + local_track.palette[2][0] + "," + local_track.palette[2][1] + "," + local_track.palette[2][2] + "," + background_opacity + ")," +
      "rgba(" + local_track.palette[3][0] + "," + local_track.palette[3][1] + "," + local_track.palette[3][2] + "," + background_opacity + ")," +
      "rgba(" + local_track.palette[4][0] + "," + local_track.palette[4][1] + "," + local_track.palette[4][2] + "," + background_opacity + ")," +
      "rgba(" + local_track.palette[5][0] + "," + local_track.palette[5][1] + "," + local_track.palette[5][2] + "," + background_opacity + ")");
    angle += (rotation_velocity);
  }

  //Function to fetch a new access token from a given API endpoint (Async).
  function getToken(done) {
    console.log("getting new token");
    $.get("/auth/token/new", function(data) {
      if (data.error) {
        if (data.error.reason == "refresh_token_expired") {
          console.log("App has become unauthorised.");
          handle_error("refresh_token_expired");
        } else {
          console.log("Unknown Error.");
        }
      } else {
        console.log("token success");
        done(data.access_token);
      }
    });
  }

  //start tickers for position seeker and rotating background.
  function resume_tickers() {

    //Start a rotation ticker (if not already started).
    if (!rotator_ticker) rotator_ticker = window.setInterval(update_background, 17);

    //Start a position ticker (if not already started).
    if (!position_ticker) position_ticker = window.setInterval(update_position, 17);

  }

  //stop tickers for position seeker and rotating background.
  function pause_tickers() {

    //stop a rotation ticker (if not already stopped).
    if (rotator_ticker) {
      window.clearInterval(rotator_ticker);
      rotator_ticker = null;
    }

    //stop a position ticker (if not already stopped).
    if (position_ticker) {
      window.clearInterval(position_ticker);
      position_ticker = null;
    }

  }

  //Function which progresses the position of the seeker bar.
  function update_position() {
    if (!error_state) {
      if (prev_time + 50 < Date.now()) {
        prev_time = Date.now();
        //50 ms + 5ms to account for drift, measured to be around 5ms per update cycle.
        local_track.position += 55;
        update_controls_UI();
      }
    }
  }

  //convert a millisecond time into a pretty string.
  function ms_to_string(ms) {

    var string_time = "";

    //Get hour, minuite and second values for the millisecond value.
    var hour = parseInt((ms / (1000 * 60 * 60)) % 24);
    var min = (parseInt((ms / (1000 * 60)) % 60)).toString();
    var sec = (parseInt((ms / 1000) % 60)).toString();

    //Account for single digit values. Convert to strings.
    if (sec <= 9) sec = "0" + sec;
    if (min <= 9) min = "0" + min;
    if (hour <= 9) hour = "0" + hour;

    //Account for zero hours.
    if (hour != "00") string_time += (hour + ":");

    //Build and return the string format of the time.
    string_time += (min + ":" + sec);
    return string_time;

  }

  //Handle errors by displaying a banner to the user.
  function handle_error(error) {

    //reset the player.
    reset_player();

    //Log the error to the console.
    console.error(error);

    //If we are not already in an error state, then change state.
    if (!error_state) {

      //Set the player to an error state (prevents updates)
      error_state = true;

      //Define and show an error message.
      var message = "Oops - Something went wrong (code: " + error + ").";
      $("#error_banner p").text(message);
      $("#error_banner").animate({ bottom: "-=40px" }, 1000);

    }

  }

  //Function to visit the Spotify API and get track features using the 'features' endpoint
  function get_features_from_track(track_object, done) {

    var features = {};

    //If a track is being played (over say an episode or advert) then features are avaliable.
    if (track_object.type == "track") {

      //Define endpoint URL
      var audio_features_url = "https://api.spotify.com/v1/audio-features/" + track_object.id;

      //Define AJAX call, adding the bearer token as authentication.
      $.ajax({
        url: audio_features_url,
        type: "GET",
        beforeSend: function(xhr) { xhr.setRequestHeader('Authorization', 'Bearer ' + token); },
        success: function(data) {


          //Update the local_track with track features.
          features = {
            "tempo": data.tempo,
            "energy": data.energy,
            "loudness": data.loudness,
            "valence": data.valence
          }

          //prevent loudness being too quiet (for the purpose of the background opacity)
          if (features.loudness < -15) features.loudness = -15;

          //Scale the loudness between 0 and 1 (where 1 is the loudest);
          features.loudness = Number(((features.loudness + 15) / 15).toPrecision(3));

          console.log("features recieved");

          //done, so return to a callback.
          done(features);

        },
        error: function() {
          done(default_features());
        }

      });
    } else {
      done(default_features());
    }
  }

  //A function which returns the default features of a track object.
  function default_features() {
    //resets for features.
    return {
      "tempo": 50,
      "energy": 0.5,
      "loudness": 0.5,
      "valence": 0.5
    }
  }

  //Set the features of the background based on the features of the track.
  function set_background_features(features) {
    rotation_velocity = Number(((features.tempo * features.energy) / 2500).toPrecision(2));
    background_opacity = 0.5 + ((features.valence + features.loudness) / 4)
    console.log(background_opacity);
  }

  //Show the control bar.
  function show_controls() {

    //Let the mouse movement lister know that the controls are no longer hidden.
    controls_hidden = false;

    //Stop any animations that the control bar might have from the hide_controls function.
    $("#control_container").stop();

    //Reset the cursor to the default.
    $(document.body).css("cursor", "default");

    //Set the control bar to full opacity.
    $("#control_container").css("opacity", "1");

  }

  //Hide the control bar.
  function hide_controls() {

    //Let the mouse movement lister know that the controls are now hidden.
    controls_hidden = true;

    //Hide the cursor on the body.
    $(document.body).css("cursor", "none");

    //Fade out the control bar over 1500ms using opacity.
    $("#control_container").animate({ opacity: 0 }, 1500);

  }

  //Function to ping the server and check for online connectivity.
  function check_online() {

    //Define AJAX call, adding the bearer token as authentication, to visit an arbituary endpoint.
    $.ajax({
      url: "/ping",
      type: "GET",
      complete: function(xhr, textStatus) {
        //If status is 200, then we are online. Else, offline.
        if (xhr.status != 0) {
          //If we are recovering from an error, reload.
          if (error_state) location.reload(true);
        } else {
          //Handle Error
          handle_error("offline");
        }
      }
    });
  }

  //Mouse movement listener for the whole document.
  $(document).mousemove(function() {

    //On mouse move, cleae the inactivity timer.
    window.clearTimeout(inactivity_timer);

    //If the controls are hidden, then show them.
    if (controls_hidden) show_controls();

    //Reactivate the inactivity timer to wait for inactivity, and hide the controls is inactive.
    inactivity_timer = window.setTimeout(hide_controls, activity_timeout);

  });

  //Ininitate the player UI components.
  reset_player();

});