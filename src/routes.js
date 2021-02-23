'use strict';

const { repo } = require('./repo');
const {sha256} = require('crypto-hash');

/**
 * Max age for a token. Currently one day
 */
const tokenMaxAge = 24 * 3600 * 1000;

/**
 * Generates a new token for the user
 * @param {string} username 
 * @param {string} password 
 */
async function generateToken(username, password) {

	const now = Date.now();

	// Generate hash
	const hash = await sha256(username + password + now);

	return {
		username: username,
		time: now,
		hash: hash,
	};
}

/**
 * Check if the token is valid
 * @param {object} token should be a json object containing {username, time, hash}
 */
async function checkToken(token) {
	
	// Check token integrity
	if(!token || !token.username || !token.time || !token.hash) {
		return false;
	}

	// Check token expiration date (1 day)
	if(token.time + tokenMaxAge < Date.now()) {
		return false;
	}

	// Check token hash
	const storedTokenHash = await repo.getTokenHash(token.username);
	if(storedTokenHash != token.hash) {
		return false;
	}

	return true;
}

/**
 * Helper method to set the token cookie in a response
 */
function setTokenCookie(resp, token) {
	resp.cookie("token", token, {
		signed: false,
		secure: false,
		expires: new Date(token.time + tokenMaxAge)
	});
}

function validateUsername(str) {
	// Check if input is a valid string
	if(!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if(str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if(!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}
	
	return true;
}

function validatePassword(str) {
	// Check if input is a valid string
	if(!str || typeof str !== 'string') {
		return false;
	}

	// Check length
	if(str.length <= 0 || str.length > 20) {
		return false;
	}

	// Check with regex if name contains only allowed characters
	if(!(/^[0-9a-zA-Z]+$/.test(str))) {
		return false;
	}

	return true;
}

function routes(app) {

	/**
	 * API that can be used to sign in as a new user and then login.
	 * It requires valid username and password.
	 * It also renews the token.
	 */
	app.post('/signin', async (req, resp) => {
		
		const { username, password } = req.body;

		// Validate username
		if(!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({error: "Please provide valid username and password"});
			return;
		}

		// Check if user is already registered
		if(await repo.isUserRegistered(username)) {
			resp.status(400);
			resp.json({error: "Username is already registered"});
			return;
		}

		// Generate new token
		const token = await generateToken(username, password);

		// Register new user (with token)
		await repo.registerUser(username, password, token);

		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	/**
	 * API that can be used to login given valid username and password.
	 * It also renews the token.
	 */
	app.post('/login', async (req, resp) => {

		// Check for submitted username and password
		const { username, password } = req.body;

		// Validate username and password
		if(!validateUsername(username) || !validatePassword(password)) {
			resp.status(400);
			resp.json({error: "Please provide valid username and password"});
			return;
		}

		// Check if user is registered
		if(!(await repo.isUserRegistered(username))) {
			resp.status(400);
			resp.json({error: "Username is not registered"});
			return;
		}

		// Get stored password for username
		const storedPassword = await repo.getUserPassword(username);

		// If passwords don't match, the sumbitted password is wrong
		if(storedPassword != password) {
			resp.status(401);
			resp.json({error: "Password is wrong"});
			return;
		}

		// Generate new token
		const token = await generateToken(username, password);

		// Update token in database
		await repo.updateToken(token)
	
		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	/**
	 * API call that can be used to login given a valid token.
	 * It also renews the token. 
	 */
	app.post('/login-token', async (req, resp) => {

		// Check if user has a valid token
		var token = req.cookies.token;
		if(!(await checkToken(token))) {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({error: "Token is not valid"})
			return;
		}

		// Renew token
		token = await generateToken(token.username, await repo.getUserPassword(token.username));
		// Update token in database
		await repo.updateToken(token)
		
		resp.status(200);
		setTokenCookie(resp, token);
		resp.end();
	});

	app.get("/projects", async (req, resp) => {
		const token = req.cookies.token;

		if(await checkToken(token)) {
			resp.status(200);
			resp.json({projects: await repo.getProjects()});
		} else {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({projects: await repo.getProjects(), error: "Token is not valid"});
		}
	});

	app.post("/project", async (req, resp) => {
		
		const token = req.cookies.token;

		const { title } = req.body;

		if(await checkToken(token)) {
			resp.status(200);
			resp.json({project: await repo.getProject(title)});
		} else {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({projects: await repo.getProject(title), error: "Token is not valid"});
		}
	});

	app.get('/users', async (req, resp) => {

		const token = req.cookies.token;

		if(await checkToken(token)) {
			resp.status(200);
			resp.json({users: await repo.getUsers()});
		} else {
			resp.status(401);
			resp.clearCookie("token");
			resp.json({users: await repo.getUsers(), error: "Token is not valid"});
		}
	});
}

module.exports = { routes };
