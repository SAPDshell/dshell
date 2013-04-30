repMiddleware = function (req, res, next) {
	try {
		var rep = require('url').parse(req.url, true).query.repo;
		if(rep) {
			req.rep = rep;
			next();
		}
		else {
			res.write("Deployment Shell v1.0.0\n");
			res.write("Copyright 2013 SAP Labs, LLC\n");
			res.write("\n");
			res.write("- Dominik Tornow <dominik.tornow@sap.com>\n");
			res.write("- Joerg Latza <joerg.latza@sap.com>\n");
			res.write("\n");
			res.write("Usage: dshell.saphana.com?repo=http://github.com/your/repo\n");
			res.write("\n");
			res.write("Read the manual @ http://scn.sap.com/people/dominik.tornow/blog/2013/04/26/dshell-manual\n");
			res.write("Read the story @ http://scn.sap.com/people/dominik.tornow/blog/2013/04/26/dshell-story\n");
			res.end();
		}
	} catch (e) {
		res.end(e.toString());
	}
}

dirMiddleware = function (req, res, next) {
	try {
		var dir = 'z' + require('crypto').randomBytes(4).readUInt32LE(0),
		    end = res.end;
		res.end = function(chunk, encoding) {
			res.end = end;
			require('child_process').exec("rmdir " + dir + "/S /Q", function(err, stdout, stderr) {
				console.log("delete", err);
				res.end(chunk, encoding);
			});
		}
		require('fs').mkdir(dir, function(e) {
			req.dir = dir;
			next();
		})
	}
	catch (e) {
		res.end(e.toString());
	}
}

var app = require('connect')()
    .use(require('connect').static('strategies'))
	.use(repMiddleware)
	.use(dirMiddleware)
	.use(function(req, res){
		require('child_process').exec("git clone " + req.rep + " repo", {cwd: req.dir}, function(err, stdout, stderr) {

			var deploy = JSON.parse(require('fs').readFileSync(req.dir + "/repo/deployment.json"));

			res.write("Requested\n");
			res.write(JSON.stringify(deploy) + "\n");

			install(deploy.strategy, req.dir, function(err, strategy) {
				if (err) {
					res.writeHead(400);
					res.end(err.toString());
					return;
				}
				strategy(req.dir + "/repo", deploy, function(err, msg) {
					res.writeHead(200);
					res.end(msg);
				});
			});
		})
	}).listen(80);

var install = function(strategy, dir, cb) {
	try {
		var npm = require("npm");
		// https://npmjs.org/api/npm.html
		npm.load({}, function(err, npm) {
			// npm object loaded
			try {
				npm.commands.install([strategy], function(err, modules) {
					// ignore err, on err try locally
					try {
						// force a reload on require
						// http://nodejs.org/docs/latest/api/globals.html#globals_require_cache
						delete require.cache[modules[0][0].split("@")[0]];
						// require
						cb(null, require(modules[0][0].split("@")[0]));
					} catch (ex) {
						cb(ex);
					}
				})
			// on exception try locally
			} catch(ex) {
				try {
					// force a reload on require
					// http://nodejs.org/docs/latest/api/globals.html#globals_require_cache
					delete require.cache[modules[0][0].split("@")[0]];
					// require
					cb(null, require(modules[0][0].split("@")[0]));
				} catch (ex) {
					cb(ex);
				}
			}
		})
	} catch(ex) {
		cb(ex);
	}
}
