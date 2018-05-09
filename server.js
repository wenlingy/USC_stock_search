var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const path = require("path");

var urlencodedParser = bodyParser.urlencoded({ extended: false })
var api_data = new Object();

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.get('/autocomplete', function(req, res) {
  var input = req.query.input;
  console.log("autocomplete request for " + input);
  var url = "http://dev.markitondemand.com/MODApis/Api/v2/Lookup/json?input="+input;
  http.get(url, resp => {
    resp.setEncoding("utf8");
    let body = "";
    resp.on("data", data => {
      body += data;
    });
    resp.on("end", () => {
      body = JSON.parse(body);
      res.send(body);
    });
  });
})


function createURL(symbol) {
  var url_p1 = "https://www.alphavantage.co/query?function=";
  var url_p2 = "&symbol=";
  var url_p3 = "&interval=daily&time_period=10&series_type=open&apikey=946ZYM4CS8FSW3PE";
  var url_p4 = "&outputsize=full&interval=daily&time_period=10&apikey=946ZYM4CS8FSW3PE";
  var url_news = "https://seekingalpha.com/api/sa/combined/"+symbol+".xml"; //url to retrive news data
  var URL = [
    url_p1+"TIME_SERIES_DAILY"+url_p2+symbol+url_p4,
    url_p1+"SMA"+url_p2+symbol+url_p3,
    url_p1+"EMA"+url_p2+symbol+url_p3,
    url_p1+"STOCH"+url_p2+symbol+url_p3,
    url_p1+"RSI"+url_p2+symbol+url_p3,
    url_p1+"ADX"+url_p2+symbol+url_p3,
    url_p1+"CCI"+url_p2+symbol+url_p3,
    url_p1+"BBANDS"+url_p2+symbol+url_p3,
    url_p1+"MACD"+url_p2+symbol+url_p3,
    url_news
  ];
  return URL;
}
// This responds a POST request for the homepage
app.post('/stock', urlencodedParser, function(req, res) {
	//console.log(req.body);
	var symbol = req.body.symbol; //key-value pairs of data submitted in the request body
  api_data[symbol] = new Object();
  //console.log(symbol);
  var url_post = createURL(symbol);
	for(var indicator_type=0; indicator_type < url_post.length-1; indicator_type++) {
	//for(var indicator_type=0; indicator_type < 7; indicator_type++) { //use price and sma to test
		//console.log(URL[indicator_type]);
		setTimeout(requestStockdata, 0, url_post, indicator_type, symbol);
	}
  setTimeout(requestNewsdata, 0, url_post, url_post.length-1, symbol);
	res.end(); //end the response process
})

	function requestStockdata(URL, indicator_type, symbol) {
		var url = URL[indicator_type];
		https.get(url, res => {
			res.setEncoding("utf8");
			let body = "";
			res.on("data", data => {
				body += data;
			});
			res.on("end", () => {
        //console.log(res.statusCode);
        if(res.statusCode != "503") {
          try{
            body = JSON.parse(body);
            //parse StockData
            //console.log(body["Meta Data"]);
            if(body["Meta Data"] == undefined) {
              //console.log(indicator_type+ "'s information didn't get");
              setTimeout(requestStockdata, 0, URL, indicator_type, symbol);
            }
            else {
              parseApiData(body, symbol);
            }
          }
          catch (err) {
            setTimeout(requestStockdata, 0, URL, indicator_type, symbol);
          }
        }
			});
		});
	}
  function requestNewsdata(URL, idx, symbol) {
    var url_news = URL[idx];
    https.get(url_news, res => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", data => {
        body += data;
      });
      res.on("end", () => {
        //console.log(body);
        if(res.statusCode != "503") {
          var parseString = require('xml2js').parseString;
          var news_xml = body;
          parseString(news_xml, function(err, result) {
            //console.dir(result);
            //console.log(JSON.stringify(result));
            if(result["rss"] == undefined) {
              setTimeout(requestNewsdata, 0, URL, idx, symbol);
            }
            else {
              parseNewsData(result,symbol);
            }
          });
        }

      });
    });
  }


	function parseApiData(body, symbol) {
		var indicator_type = Object.keys(body)[1];
		//console.log(indicator_type);
    var time = Object.keys(body[indicator_type]).slice(0,132).reverse();
    if(indicator_type === "Time Series (Daily)") {
      //for the historical chart
      var alltime = Object.keys(body["Time Series (Daily)"]).reverse();
      api_data[symbol]["allStockValue"] = new Object();
      for(var i=0; i<alltime.length; i++) {
        api_data[symbol]["allStockValue"][alltime[i]] = body["Time Series (Daily)"][alltime[i]];
      }
    }
		//console.log(time);
		api_data[symbol][indicator_type] = new Object();
		for(var i=0; i<time.length; i++) {
      if(indicator_type === "Time Series (Daily)" && i == time.length-1) {
        var curday_data = body[indicator_type][time[i]];
        time[time.length-1] = body["Meta Data"]["3. Last Refreshed"];
        api_data[symbol][indicator_type][time[i]] = curday_data;
        break;
      }
			api_data[symbol][indicator_type][time[i]] = body[indicator_type][time[i]];
		}
		//console.log(api_data);
	}
  function parseNewsData(result, symbol) {
    api_data[symbol]["news"] = new Array();
    var newsitem = result["rss"]["channel"][0]["item"];
    var counter = 0;
    while(counter < 5) {
      //api_data["news"][counter] =newsitem[counter];
      api_data[symbol]["news"].push(newsitem[counter]);
      counter++;
    }
    newsResp = api_data[symbol]["news"];
  }

	app.get('/updatedata', function(req, res) {
    var symbol = req.query.symbol;
		if(api_data[symbol][req.query.key] == undefined) {
			//console.log("show progress bar later");
			res.send("data not ready yet");
		}
		else {
			res.send(JSON.stringify(api_data[symbol][req.query.key]));
		}
	})



  favorite_data = new Object();
  app.get('/updatefavorite', function(req, res) {
    var symbol = req.query.symbol;
    //console.log("favorite request for " + symbol);
    var url_p1 = "https://www.alphavantage.co/query?function=";
  	var url_p2 = "&symbol=";
  	var url_p4 = "&outputsize=full&interval=daily&time_period=10&apikey=946ZYM4CS8FSW3PE";
    var url = url_p1+"TIME_SERIES_DAILY"+url_p2+symbol+url_p4;

    https.get(url, resp => {
			resp.setEncoding("utf8");
			let body = "";
			resp.on("data", data => {
				body += data;
			});
			resp.on("end", () => {
        if(res.statusCode != "503") {
          try{
            body = JSON.parse(body);
            //parse StockData
            if(body["Meta Data"] == undefined) {
              //console.log("favorite's information didn't get");
              res.send("favorite data not ready yet");
            }
            else {
              //console.log("favorite data got, wait to parse");
              parseFavoriteData(body, symbol,res);
              console.log("favorite data send for " + symbol);
              res.send(JSON.stringify(favorite_data[symbol]));
            }
          }
          catch(err) {
            res.send("favorite data not ready yet");
          }

        }

			});
		});
  })

  function parseFavoriteData(body, symbol) {
    //console.log(body);
    var time = Object.keys(body["Time Series (Daily)"]).slice(0,2);
    favorite_data[symbol] = new Object();
    for(var i=0; i<time.length; i++) {
      favorite_data[symbol][time[i]] = body["Time Series (Daily)"][time[i]];
    }
    //console.log(favorite_data);
  }

  app.use(express.static(path.join(__dirname, 'public')));
  var port = process.env.PORT || 8081;

	var server = app.listen(port, function() {
		//var host = server.address().address
		//var port = server.address().port
		console.log("application listening at http://%s",port)
	})
