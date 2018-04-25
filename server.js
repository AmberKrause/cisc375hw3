//Sets up the requirement to use
var fs = require('fs');
var path = require('path');
var http = require('http');
var url = require('url');

//Sets up Modules for use
var express = require('express');
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var validator = require('express-validator');
var querystring = require('querystring');

var app = express();
var port = 3000;

//ArraySets
var sqlHolder = [];
var sqlTitleArray = [];
var sqlTitlePrincipalsArray = [];
var sqlPeopleArray = [];


//middleware, required to use the modules
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
//app.use(validator());
app.use(validator({
    errorFormatter: function(param, msg, value, location) {
        var namespace = param.split('.'),
        root = namespace.shift(),
        formParam = root;

        while(namespace.length) {
            formParam += '['+namespace.shift()+']';
        }
        return {
            param: formParam,
            msg: msg,
            value: value
        };
    }
}));//validator

//view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//set static path
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
	res.render('index', {
			errors: undefined
	});//res.render end
});


//POST request from search form in index.html
app.post('/search', (req, res) => {
    req.checkBody('search_text', 'Please provide something to search').notEmpty();

    console.log(req.headers);
    console.log(req.body);

    //validate form input
    //req.checkBody('search-text', 'Enter text to search').trim().isLength({min: 1});
    req.sanitizeBody('search_text').trim();
    req.sanitizeBody('search_text').escape();
    req.sanitizeBody('search_text').blacklist('\\(\\)\\;');
    var errors = req.validationErrors();
    if (errors) { //Sends to an Error Page, telling you what is wrong
        console.log(errors)
        res.render('index', {
            errors: errors
        });//res.render end
    }//if(errors)

    else
    { //Correct input sends you to the results page

			var search_text = req.body.search_text.replace(/\*/g, "%");//use wildcard character

			if(req.body.category === 'title')
			{
				console.log('title entered');
				var sql = 'SELECT tconst, primary_title, title_type, start_year, end_year FROM Titles WHERE primary_title LIKE "' + search_text + '%";';
				console.log(sql);
			}
			else if(req.body.category === 'person')
			{
				console.log('person entered');
				var sql = 'SELECT nconst, primary_name, primary_profession, birth_year, death_year FROM Names WHERE primary_name LIKE "' + search_text + '%";';
				console.log(sql);
			}

      getData(sql, req.body.category).then(function(sqlHolder) {//promise
          console.log('then function');
          res.render('results', { //prints out sql to results page
          sqlHolder: sqlHolder
          });//res.render end
          return sqlHolder;
      	}, function() {
					//rejection callback
					//gets called if the query returned no results
					console.log('query promise rejected')
					var errors = [{msg:'No results. Please try another search'}];
					res.render('index', {
	            errors: errors
	        });//res.render end
			});//getData promise end
    }//else

});//app.post end

app.post('/updateTitle', (req, res) => {
  console.log(req.headers);
  console.log(req.body);



});//app.post end



//New Get 4-22-18
app.get('/title', function(req, res){
	var titlePromise = getExtendData(req.query.id);
  var peoplePromise = getTitlePrincipalData(req.query.id);

  Promise.all([titlePromise, peoplePromise]).then(function(values){//promise
		res.render('title', {
			sqlTitleArray: values[0],
      sqlTitlePrincipalsArray: values[1]
    });//res.render end
    //console.log(values);
    //console.log(values[0]);
		console.log('Title Array'+' '+values[0]+' Title Principals Array: '+values[1]);
	}).catch(function(err) {
      console.log('Error when rendering title page:' + err.message);
  });//getExtendedData end
})//app.get end

//New Get 4-22-18
app.get('/person', function(req, res){
	getPersonData(req.query.id).then(function(sqlPeopleArray){//promise
		res.render('person', {
			sqlPeopleArray: sqlPeopleArray
		});//res.render end
		console.log('People Array'+sqlPeopleArray)
	}).catch(function(err) {
      console.log('Error when rendering person page:' + err.message);
  });//getExtendedData end
})//app.get end

app.listen(port, () => {
	console.log('Now listening on port ' + port);
});//app.listen end

function getData(sql, method) { //gets the SQL data
    var sqlItem = sql;
    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var myPromise = new Promise(function(resolve, reject) {
        var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
					if(err) {
						return console.error(err.message);
					}
				});
        sqlHolder = []; //resets the sqlHolder array to be empty so data doesn't repeat
        dbs.all(sqlItem, [], (err, rows) => { rowlength = rows.length; console.log(rowlength);
        if(err) {// logs error
            console.log(err);
        }//if(err)

				//reject promise if no rows to prevent infinite loop
				if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}

				//fill sqlHolder with data from each row
				rows.forEach((row) => { currentrowlength += 1;
						if(method === 'title') {

						    sqlHolder.push({
				            //set Var name: actual variable
				            //for results: data for results
										type: method,
										tconst: row.tconst,
				            primary_title: row.primary_title,
				            title_type: row.title_type,
				            start_year: row.start_year,
				            end_year: row.end_year
								});//sql push
						} else if(method === 'person') {
								sqlHolder.push({
										//set Var name: actual variable
										//for results: data for results
										type: method,
										nconst: row.nconst,
										primary_name: row.primary_name,
										primary_profession: row.primary_profession,
										birth_year: row.birth_year,
										death_year: row.death_year
								});//sql push
						}

            if(currentrowlength == rowlength) { resolve(sqlHolder); console.log('Done');}
            else if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}
            //Resolving and Rejecting if statements, to determine wait for data
        });//forEach
    });//dbs end
    dbs.close()
		});//my Promise End
    return myPromise;
}//getData end

//New function 4-22-18
function getExtendData(inputID) {
    //var rowlength; //to hold rowlength
    //var currentrowlength = 0; //to hold current row

    var sqlItem = 'SELECT Titles.tconst, primary_title, title_type, start_year, end_year, runtime_minutes, genres, average_rating, num_votes, directors, writers FROM (SELECT * FROM Titles WHERE tconst="'+inputID+'") AS Titles LEFT OUTER JOIN Ratings ON Titles.tconst=Ratings.tconst LEFT OUTER JOIN Crew ON Titles.tconst=Crew.tconst';
    sqlTitleArray = []; //resets the sqlHolder array to be empty so data doesn't repeat

	   var myPromise = new Promise(function(resolve, reject) {
	     var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
	        if(err) {
            return console.error(err.message);
             }//if(err) end
	      });//dbs end
	      console.log(sqlItem);
        dbs.get(sqlItem, [], (err, row) => {
        	console.log(row);
        	if(err) {// logs error
            console.log(err);
        	}//if(err)

    			//reject promise if no rows to prevent infinite loop
    			if(row === undefined) {reject('No query results');}
    			//fill sqlHolder with data

            sqlTitleArray = row;
            console.log('sqlTitleArray:' + sqlTitleArray);
            resolve(sqlTitleArray);
            console.log('Done Title Data');
            //Resolving and Rejecting if statements, to determine wait for data
        //});//forEach
      });//dbs end
      dbs.close();
	   });//Promise End
	return myPromise;

}//getExtendedData End


//New function 4-22-18
function getTitlePrincipalData(inputID) {
    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var sqlItem = 'SELECT Titles.tconst, ordering, Principals.nconst, category, primary_name FROM (SELECT * FROM Titles WHERE tconst='+'"'+inputID+'") AS Titles LEFT OUTER JOIN Principals ON Titles.tconst=Principals.tconst LEFT OUTER JOIN Names ON Principals.nconst=Names.nconst ORDER BY ordering';
    sqlTitlePrincipalsArray = []; //resets the sqlHolder array to be empty so data doesn't repeat

	   var myPromise = new Promise(function(resolve, reject) {
	     var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
	        if(err) {
            return console.error(err.message);
             }//if(err) end
	      });//dbs end
	      //console.log(sqlItem);
        dbs.all(sqlItem, [], (err, rows) => {
          if(rows === undefined) {
            reject('No query results');
          }
          //console.log(rows);
        	//console.log('rowlength = rows.length')

        	if(err) {// logs error
            console.log(err);
        	}//if(err)

          var rowlength = rows.length;
    			//reject promise if no rows to prevent infinite loop
    			if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}
    			//fill sqlHolder with data

    			rows.forEach((row) => { currentrowlength += 1;
    				sqlTitlePrincipalsArray.push({
    					  tconst: row.tconst,
    				    ordering: row.ordering,
    				    nconst: row.nconst,
    				    category: row.category,
                primary_name: row.primary_name
    				});//sql push

            if(currentrowlength == rowlength) { resolve(sqlTitlePrincipalsArray); console.log('Done Principals Data for Title'); }

          });//forEach
      });//dbs end
      dbs.close();
	   });//Promise End
	return myPromise;


}//getTitlePrincipalData End




//New function 4-22-18
function getPersonData(inputID) {

    var rowlength; //to hold rowlength
    var currentrowlength = 0; //to hold current row
    var sqlItem = 'SELECT primary_name, birth_year, death_year, primary_profession, known_for_titles FROM Names WHERE nconst='+'"'+inputID+'"';
    sqlPeopleArray = []; //resets the sqlHolder array to be empty so data doesn't repeat
    console.log(sqlItem);
    console.log(sqlPeopleArray+'Before dbs')
	var myPromise = new Promise(function(resolve, reject) {
		var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
			if(err) {
				return console.error(err.message);
			}//if(err) end
		});//dbs end

        dbs.all(sqlItem, [], (err, rows) => {
        	console.log(rows);
        	console.log('rowlength = rows.length')
        	var rowlength = rows.length;
        	if(err) {// logs error
            console.log(err);
        	}//if(err)

			//reject promise if no rows to prevent infinite loop
			if(rowlength < 1) {reject('Unsuitable Data for usage because of 0 length!');}

			//fill sqlHolder with data from each row
			rows.forEach((row) => { currentrowlength += 1;
				sqlPeopleArray.push({
					primary_name: row.primary_name,
					primary_profession: row.primary_profession,
					birth_year: row.birth_year,
					death_year: row.death_year,
					known_for_titles: row.known_for_titles
				});//sql push

            if(currentrowlength == rowlength) { resolve(sqlPeopleArray); console.log('Done Person Data');}
            //Resolving and Rejecting if statements, to determine wait for data
        });//forEach
    });//dbs end
    dbs.close();
    console.log(sqlPeopleArray+'after dbs')
	});//Promise End
	return myPromise;
}//getPersonData End













//area for test queriesvar dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {
/*var sqlItem = 'SELECT DISTINCT title_type FROM Titles';
var dbs = new sqlite3.Database('./imdb.sqlite3', (err) => {


   if(err) {
     return console.error(err.message);
      }//if(err) end
 });//dbs end
 console.log(sqlItem);
 dbs.all(sqlItem, [], (err, rows) => {
   console.log(rows);
   console.log('rowlength = rows.length')
   var rowlength = rows.length;
   if(err) {// logs error
     console.log(err);
   }//if(err)



   rows.forEach((row) => {
     console.log(row.title_type);



   });//forEach
});//dbs end*/
