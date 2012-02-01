var redis = require("redis"),
    client = redis.createClient();

client.on("error", function (err) {
    console.log("Error " + err);
});

var twss = require('twss');
twss.threshold = 0.99999;

var twitter = require('ntwitter');
var credentials = require('./credentials');

var twit = new twitter({
  consumer_key: credentials.consumer_key,
  consumer_secret: credentials.consumer_secret,
  access_token_key: credentials.access_token_key,
  access_token_secret: credentials.access_token_secret
});

twit.stream('statuses/filter', {'locations':'-124.453125,29.458731,-68.291016,49.037868'}, function(stream) {
  stream.on('data', function (data) {
  	var str = data.text.replace(/@\S*/g, '');
	
	if(twss.is(str)) {
  		client.rpush('tweets', JSON.stringify(data));
  		console.log(twss.probability(str) + ' ' + str);
  	}
  });
});

var app = require('express').createServer();
app.set('view engine', 'ejs');
app.set('view options', {
	layout: false
});

app.get('/', function(req, res){
	var count;
	client.llen('tweets', function(err, len) {
		count = len - 1;
	});
	client.lrange('tweets', 0, 0, function(err, data) {
		if (data != '') {
			tweet = JSON.parse(data);
		} else {
			tweet = new Object;
			tweet.text = 'No tweets remaining';
		}
		res.render('index', { 
			tweet: tweet.text,
			count: count
		});
	});
});

app.get('/tweet', function(req, res) {
	client.lpop('tweets', function(err, data) {
		data = JSON.parse(data);
		twit.createFriendship(data.user.screen_name, function(err, data) {
			console.log('err ' + err);
			console.log('data ' + data);
		});
		twit.updateStatus('@' + data.user.screen_name + ' dat what she say!',
			{in_reply_to_status_id: data.id_str},
			function (err, data) {
				console.log('err ' + err);
				console.log('data ' + data);
				res.redirect('/');
			}
		);
	});
});

app.get('/skip', function(req, res) {
	client.lpop('tweets');
	res.redirect('/');
});

app.get('/trim', function(req, res) {
	client.llen('tweets', function(err, len) {
		len -= 100;
		if (len > 0) {
			for(;len>0;len--) {
				client.lpop('tweets');
			}
		}
	});
	res.redirect('/');
});

app.listen(3000);